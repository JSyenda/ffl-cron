import { ObjectId } from "mongodb"
import { getMongoDb } from "./mongodb"
import type { MongoKV } from "./mongo-kv"

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function buildDiscordAvatarUrl(discordId: string, avatarHash: string | null): string | null {
  if (!discordId || !avatarHash) return null
  const ext = avatarHash.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=256`
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeRoles(roles: Array<{ id: string; name: string }> | undefined | null) {
  return (roles ?? [])
    .filter((r): r is { id: string; name: string } => Boolean(r?.id && r?.name))
}

function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

// --- Discord guild roles fetch ---
async function fetchDiscordRoles(discordId: string, guildId: string, botToken: string) {
  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  }
  try {
    const [memberRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers, cache: "no-store" }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers, cache: "no-store" }),
    ])
    if (!memberRes.ok || !rolesRes.ok) return { roles: [], displayName: null }
    const member = (await memberRes.json()) as { roles?: string[]; nick?: string | null; user?: { username?: string | null; global_name?: string | null } }
    const allRoles = (await rolesRes.json()) as Array<{ id?: string; name?: string }>
    const roleNameById = new Map(
      allRoles.filter((r): r is { id: string; name: string } => Boolean(r.id && r.name)).map((r) => [r.id, r.name])
    )
    const displayName = member.nick || member.user?.global_name || member.user?.username || null
    const roles = (member.roles || [])
      .map((roleId) => {
        const name = roleNameById.get(roleId)
        return name ? { id: roleId, name } : null
      })
      .filter((r): r is { id: string; name: string } => Boolean(r))
    return { roles, displayName }
  } catch {
    return { roles: [], displayName: null }
  }
}

// --- Player ID inference ---
async function inferPlayerIdFromDiscord(db: import("mongodb").Db, discordId: string): Promise<import("mongodb").ObjectId | null> {
  const eloPlayer = await db.collection("eloplayers").findOne({ discordId }, { projection: { playerId: 1, nickname: 1 } })
  if (!eloPlayer) return null

  const candidateIds = new Set<string>()
  const names = [eloPlayer.nickname, eloPlayer.playerId]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)

  for (const pid of names) {
    if (/^\d+$/.test(pid)) {
      const p = await db.collection("players").findOne({ player_id: Number(pid) }, { projection: { _id: 1 } })
      if (p?._id) candidateIds.add(p._id.toString())
    }
  }
  for (const name of names) {
    if (!/^\d+$/.test(name)) {
      const ps = await db.collection("players").find({ player_name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }, { projection: { _id: 1 } }).toArray()
      ps.forEach((p) => candidateIds.add(p._id.toString()))
    }
  }
  if (candidateIds.size !== 1) return null
  return new ObjectId([...candidateIds][0])
}

async function inferPlayerIdFromDisplayName(db: import("mongodb").Db, displayName: string): Promise<import("mongodb").ObjectId | null> {
  const trimmed = displayName.trim()
  if (!trimmed) return null
  const ps = await db.collection("players").find({ player_name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" } }, { projection: { _id: 1 } }).toArray()
  if (ps.length !== 1) return null
  return ps[0]._id
}

// --- syncDiscordUser (port from Mongoose) ---
export async function syncDiscordUser(
  db: import("mongodb").Db,
  discordId: string,
  discordAvatar?: string | null,
  displayNameOverride?: string | null,
  guildId?: string,
  botToken?: string
) {
  const existing = await db.collection("users").findOne({ discordId })
  const now = new Date()
  const syncedRecently =
    existing?.discordSyncedAt &&
    now.getTime() - new Date(existing.discordSyncedAt).getTime() < 1000 * 60 * 60 * 24
  const avatarChanged = Boolean(discordAvatar) && discordAvatar !== existing?.discordAvatar

  const { roles, displayName } = guildId && botToken
    ? await fetchDiscordRoles(discordId, guildId, botToken)
    : { roles: [], displayName: null }

  const resolvedDisplayName =
    displayName?.trim() ||
    displayNameOverride?.trim() ||
    existing?.discordName?.trim() ||
    null
  const displayNameChanged = Boolean(resolvedDisplayName && resolvedDisplayName !== existing?.discordName)

  if (existing && syncedRecently && !avatarChanged && !displayNameChanged) {
    return existing
  }

  const shouldTryDisplayName = Boolean(resolvedDisplayName) && (displayNameChanged || !existing?.playerId)
  const displayNamePlayerId = shouldTryDisplayName && resolvedDisplayName
    ? await inferPlayerIdFromDisplayName(db, resolvedDisplayName)
    : null
  const playerId =
    displayNamePlayerId ??
    existing?.playerId ??
    (await inferPlayerIdFromDiscord(db, discordId))

  const existingRoles = normalizeRoles(existing?.roles as Array<{ id: string; name: string }> | undefined)
  const mergedMap = new Map(existingRoles.map((r) => [r.id, r]))
  for (const r of roles) mergedMap.set(r.id, r)
  const mergedRoles = [...mergedMap.values()]

  const updateSet: Record<string, unknown> = {
    roles: mergedRoles,
    discordSyncedAt: now,
  }
  if (discordAvatar) updateSet.discordAvatar = discordAvatar
  if (resolvedDisplayName) updateSet.discordName = resolvedDisplayName
  if (playerId) updateSet.playerId = playerId

  await db.collection("users").updateOne(
    { discordId },
    { $set: updateSet, $setOnInsert: { discordId, betballCoins: 100, fantasyCoins: 10000 } },
    { upsert: true }
  )

  return db.collection("users").findOne({ discordId })
}

// --- Session management ---
export async function createSession(kv: MongoKV, userData: {
  discordId: string
  name: string | null
  image: string | null
}) {
  const token = generateSessionToken()
  const sessionData = JSON.stringify(userData)
  await kv.put(`sess:${token}`, sessionData, { expirationTtl: SESSION_TTL_SECONDS })
  return token
}

export async function getSession(kv: MongoKV): Promise<{ discordId: string; name: string | null; image: string | null } | null> {
  // We need the cookie from the request, but this helper reads from KV
  return null // Will be handled inline in session.ts
}

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.split("; ").find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null
}

export async function getSessionFromRequest(kv: MongoKV, request: Request): Promise<{
  discordId: string
  name: string | null
  image: string | null
  betballCoins: number
  fantasyCoins: number
  playerId: string | null
  roles: Array<{ id: string; name: string }>
  discordName: string | null
} | null> {
  const cookie = parseCookie(request.headers.get("cookie"), "session_token")
  if (!cookie) return null

  const data = await kv.get(`sess:${cookie}`)
  if (!data) return null

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export async function destroySession(kv: MongoKV, request: Request): Promise<string | null> {
  const cookie = parseCookie(request.headers.get("cookie"), "session_token")
  if (cookie) {
    await kv.delete(`sess:${cookie}`)
  }
  return cookie
}
