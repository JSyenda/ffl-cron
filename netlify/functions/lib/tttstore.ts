import { getMongoDb } from "./mongodb"
import type { MongoKV } from "./mongo-kv"
import { presenceKey, presenceRosterKey, challengeKey, challengeIndexKey, gameKey, userGameKey, PRESENCE_TTL, CHALLENGE_TTL, GAME_TTL } from "./ttt"

export { PRESENCE_TTL, CHALLENGE_TTL, GAME_TTL }

// getDb provides the Mongo Db (used only for persistent results/leaderboard).
export async function getDb(env: { MONGODB_URI: string }) {
  return getMongoDb(env.MONGODB_URI)
}

// All real-time interactive state (presence, challenges, usergame, games) lives
// in Cloudflare KV (fast, low-latency) instead of Mongo to avoid slow cold ops.
export type KV = MongoKV

export async function saveGame(kv: KV, game: any): Promise<void> {
  await kv.put(gameKey(game.id), JSON.stringify(game), { expirationTtl: GAME_TTL })
}

export async function getGame(kv: KV, gameId: string): Promise<any | null> {
  const v = await kv.get(gameKey(gameId))
  if (!v) return null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

export async function setUserGame(kv: KV, userId: string, gameId: string): Promise<void> {
  await kv.put(userGameKey(userId), gameId, { expirationTtl: GAME_TTL })
}

export async function clearUserGame(kv: KV, userId: string): Promise<void> {
  await kv.delete(userGameKey(userId))
}

export async function getActiveGameId(kv: KV, userId: string): Promise<string | null> {
  const gameId = await kv.get(userGameKey(userId))
  if (!gameId) return null
  const g = await getGame(kv, gameId)
  if (!g || g.status !== "playing") {
    await clearUserGame(kv, userId).catch(() => {})
    return null
  }
  return gameId
}

// --- Cumulative per-user TTT stats, persisted in KV ---
// The leaderboard must not depend on a Mongo connection from the Workers
// runtime (unreliable/dropped in production), so results are recorded here and
// Mongo remains a best-effort secondary copy.
const STATS_INDEX_KEY = "ttt:stats:index"

export interface TttStatEntry {
  userId: string
  name: string | null
  avatar: string | null
  wins: number
  losses: number
  draws: number
  games: number
}

export async function readStatsIndex(kv: KV): Promise<TttStatEntry[]> {
  const raw = await kv.get(STATS_INDEX_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export async function clearStatsIndex(kv: KV): Promise<void> {
  await kv.delete(STATS_INDEX_KEY)
}

// Record a finished match's outcome into the KV index. Cancelled matches are
// skipped so they never count as games played.
export async function recordTttResultKv(kv: KV, game: any): Promise<void> {
  if (game.cancelled) return
  const entries = await readStatsIndex(kv)
  const winnerId: string | null = game.winnerUserId || null
  const players: any[] = game.players || []

  const apply = (
    userId: string,
    delta: { wins?: number; losses?: number; draws?: number }
  ) => {
    const player = players.find((p) => p.userId === userId)
    const existing = entries.find((e) => e.userId === userId)
    const base: TttStatEntry =
      existing ?? {
        userId,
        name: player?.displayName ?? null,
        avatar: player?.avatar ?? null,
        wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
      }
    const next: TttStatEntry = {
      ...base,
      name: player?.displayName ?? base.name,
      avatar: player?.avatar ?? base.avatar,
      wins: base.wins + (delta.wins ?? 0),
      losses: base.losses + (delta.losses ?? 0),
      draws: base.draws + (delta.draws ?? 0),
      games: base.games + 1,
    }
    if (existing) Object.assign(existing, next)
    else entries.push(next)
  }

  if (winnerId) {
    const winner = players.find((p) => p.userId === winnerId)
    const loser = players.find((p) => p.userId !== winnerId)
    if (winner) apply(winner.userId, { wins: 1 })
    if (loser) apply(loser.userId, { losses: 1 })
  } else {
    for (const p of players) apply(p.userId, { draws: 1 })
  }

  await kv.put(STATS_INDEX_KEY, JSON.stringify(entries))
}

export async function createChallenge(kv: KV, ch: any): Promise<void> {
  await kv.put(challengeKey(ch.id), JSON.stringify(ch), { expirationTtl: CHALLENGE_TTL })
  await addChallengeToIndex(kv, ch.fromUserId, ch.id)
  await addChallengeToIndex(kv, ch.toUserId, ch.id)
}

async function readChallengeIndex(kv: KV, userId: string): Promise<string[]> {
  const raw = await kv.get(challengeIndexKey(userId))
  if (!raw) return []
  try {
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

async function writeChallengeIndex(kv: KV, userId: string, ids: string[]): Promise<void> {
  await kv.put(challengeIndexKey(userId), JSON.stringify(ids), { expirationTtl: CHALLENGE_TTL * 4 })
}

async function addChallengeToIndex(kv: KV, userId: string, id: string): Promise<void> {
  const ids = await readChallengeIndex(kv, userId)
  if (ids.includes(id)) return
  ids.push(id)
  await writeChallengeIndex(kv, userId, ids)
}

async function removeChallengeFromIndex(kv: KV, userId: string, id: string): Promise<void> {
  if (!userId) return
  const ids = await readChallengeIndex(kv, userId)
  const next = ids.filter((i) => i !== id)
  if (next.length === ids.length) return
  if (next.length === 0) await kv.delete(challengeIndexKey(userId))
  else await writeChallengeIndex(kv, userId, next)
}

export async function getChallenge(kv: KV, id: string): Promise<any | null> {
  const v = await kv.get(challengeKey(id))
  if (!v) return null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

export async function deleteChallenge(kv: KV, id: string): Promise<void> {
  const ch = await getChallenge(kv, id)
  await kv.delete(challengeKey(id))
  if (ch) {
    await removeChallengeFromIndex(kv, ch.fromUserId, id)
    await removeChallengeFromIndex(kv, ch.toUserId, id)
  }
}

export async function listChallengesFor(
  kv: KV,
  userId: string
): Promise<{ incoming: any[]; outgoing: any[] }> {
  const now = Date.now()
  const all: any[] = []
  for (const id of await readChallengeIndex(kv, userId)) {
    const v = await kv.get(challengeKey(id))
    if (!v) continue
    try {
      const c = JSON.parse(v)
      if (c.expiresAt > now) all.push(c)
    } catch {
      // ignore malformed
    }
  }
  return {
    incoming: all.filter((c) => c.toUserId === userId),
    outgoing: all.filter((c) => c.fromUserId === userId),
  }
}

export async function setPresence(
  kv: KV,
  userId: string,
  displayName: string,
  avatar: string | null
): Promise<void> {
  const existingRaw = await kv.get(presenceKey(userId))
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw)
      if (existing.updatedAt && Date.now() - existing.updatedAt < (PRESENCE_TTL * 1000) / 2) {
        return
      }
    } catch {
      // fall through and rewrite
    }
  }
  await kv.put(
    presenceKey(userId),
    JSON.stringify({
      userId,
      displayName,
      avatar: avatar ?? null,
      kind: "discord",
      updatedAt: Date.now(),
    }),
    { expirationTtl: PRESENCE_TTL }
  )
  const rosterKey = presenceRosterKey()
  let roster: string[] = []
  const raw = await kv.get(rosterKey)
  if (raw) {
    try {
      roster = JSON.parse(raw)
    } catch {
      roster = []
    }
  }
  if (!Array.isArray(roster) || !roster.includes(userId)) {
    const next = [...(Array.isArray(roster) ? roster : []), userId]
    await kv.put(rosterKey, JSON.stringify(next), { expirationTtl: PRESENCE_TTL * 2 })
  }
}

export async function listPresence(kv: KV, exceptUserId: string): Promise<any[]> {
  const rosterKey = presenceRosterKey()
  let roster: string[] = []
  const raw = await kv.get(rosterKey)
  if (raw) {
    try {
      roster = JSON.parse(raw)
    } catch {
      roster = []
    }
  }
  const now = Date.now()
  const users: any[] = []
  for (const uid of Array.isArray(roster) ? roster : []) {
    if (uid === exceptUserId) continue
    const v = await kv.get(presenceKey(uid))
    if (!v) continue
    try {
      const p = JSON.parse(v)
      if (now - (p.updatedAt || 0) <= PRESENCE_TTL * 1000) users.push(p)
    } catch {
      // ignore malformed
    }
  }
  return users
}
