import { MongoClient, type Db } from "mongodb"

// NOTE: Pages bundles functions/ per deployment — any change here invalidates
// that bundle cache. The bson static-this hazard is neutralized at build time
// (scripts/ensure-bson-patch.js + patches/bson+7.3.2.patch); keep it so.

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null
let lastPingTime = 0
const PING_INTERVAL_MS = 30_000 // only ping every 30s

function normalizeName(v: string) { return v.toLowerCase().replace(/[^a-z0-9!'.#@\-_()?:|/+*&<>,^]/g, "") }

async function ensureClient(uri: string): Promise<MongoClient> {
  if (cachedClient) {
    const now = Date.now()
    if (now - lastPingTime < PING_INTERVAL_MS) return cachedClient
    try {
      await cachedClient.db("FFL").command({ ping: 1 }, { timeoutMS: 4000 })
      lastPingTime = now
      return cachedClient
    } catch {
      try { await cachedClient.close().catch(() => {}) } catch {}
      cachedClient = null
      cachedDb = null
    }
  }
  cachedClient = new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    retryWrites: true,
    serverSelectionTimeoutMS: 4000,
    connectTimeoutMS: 4000,
    socketTimeoutMS: 10000,
    heartbeatFrequencyMS: 10_000,
  })
  await cachedClient.connect()
  cachedDb = cachedClient.db("FFL")
  lastPingTime = Date.now()
  return cachedClient
}

export async function getMongoDb(uri: string): Promise<Db> {
  await ensureClient(uri)
  return cachedDb!
}

export function getCachedDb(): Db | null {
  if (cachedDb && cachedClient) return cachedDb
  return null
}

// --- Shared (cross-isolate) persistent caches ---
const PMAP_META_ID = "playerNames"
const PCAND_META_ID = "practiceCandidates"
const META_TTL_MS = 45 * 60 * 1000

async function readMeta(db: Db, id: string): Promise<{ ts: number; entries: any } | null> {
  try {
    const meta = await db.collection("appmeta").findOne({ _id: id })
    if (!meta || !meta.ts || !Array.isArray(meta.entries)) return null
    const ts = new Date(meta.ts).getTime()
    if (Date.now() - ts > META_TTL_MS) return null
    return { ts, entries: meta.entries }
  } catch {
    return null
  }
}

function writeMeta(db: Db, id: string, entries: any) {
  db.collection("appmeta").updateOne(
    { _id: id },
    { $set: { ts: new Date(), entries } },
    { upsert: true }
  ).catch(() => {})
}

// --- Player name map cache ---
let cachedPlayerNames: Map<string, string> | null = null
let playerCacheTime = 0
const PLAYER_CACHE_TTL_MS = 60 * 60 * 1000

export async function getPlayerNameMap(db: Db): Promise<Map<string, string>> {
  const now = Date.now()
  if (cachedPlayerNames && now - playerCacheTime < PLAYER_CACHE_TTL_MS) return cachedPlayerNames

  const meta = await readMeta(db, PMAP_META_ID).catch(() => null)
  if (meta && meta.entries) {
    cachedPlayerNames = new Map(meta.entries.map((e: [string, string]) => [e[0], e[1]]))
    playerCacheTime = now
    return cachedPlayerNames
  }

  const players = await db.collection("players").find({}, { projection: { player_name: 1 } }).toArray()
  cachedPlayerNames = new Map(
    players.map((p) => {
      const display = (p.player_name ?? "").trim()
      const normalized = normalizeName(display)
      return normalized.length > 0 ? [normalized, display] as const : null
    }).filter((e): e is [string, string] => e !== null)
  )
  playerCacheTime = now
  writeMeta(db, PMAP_META_ID, [...cachedPlayerNames.entries()])
  return cachedPlayerNames
}

export function invalidatePlayerCache() { cachedPlayerNames = null; playerCacheTime = 0 }

// --- Practice candidates + player details cache ---
type CandidateEntry = {
  display: string
  normalized: string
  playerId: unknown
  country: string | null
  teamName: string | null
  teamImage: string | null
  position: string | null
}

let cachedCandidates: CandidateEntry[] | null = null
let candidateCacheTime = 0
const CANDIDATE_CACHE_TTL_MS = 60 * 60 * 1000

export async function getPracticeCandidates(db: Db): Promise<CandidateEntry[]> {
  const now = Date.now()
  if (cachedCandidates && now - candidateCacheTime < CANDIDATE_CACHE_TTL_MS) return cachedCandidates

  const meta = await readMeta(db, PCAND_META_ID).catch(() => null)
  if (meta && meta.entries) {
    cachedCandidates = meta.entries as CandidateEntry[]
    candidateCacheTime = now
    return cachedCandidates
  }

  const eligible = await db.collection("playercompetitions").aggregate([
    { $group: {
      _id: "$player_id",
      mp: { $sum: { $ifNull: ["$matchesPlayed", "$matches_played"] } },
      topPosition: { $max: { $ifNull: ["$position", ""] } },
    }},
    { $match: { mp: { $gte: 10 } } },
    { $sort: { _id: 1 } },
  ]).toArray()
  const eligibleIds = eligible.map((e) => e._id)
  if (!eligibleIds.length) { cachedCandidates = []; candidateCacheTime = now; return [] }

  const [players, teamCompAgg] = await Promise.all([
    db.collection("players").find({ _id: { $in: eligibleIds } }, { projection: { player_name: 1, country: 1 } }).sort({ _id: 1 }).toArray(),
    db.collection("playercompetitions").aggregate([
      { $match: { player_id: { $in: eligibleIds } } },
      { $group: {
        _id: { playerId: "$player_id", tcId: "$team_competition_id" },
        mp: { $sum: { $ifNull: ["$matchesPlayed", "$matches_played"] } },
        pos: { $max: { $ifNull: ["$position", ""] } },
      }},
      { $sort: { mp: -1 } },
      { $group: { _id: "$_id.playerId", topTcId: { $first: "$_id.tcId" }, position: { $first: "$pos" } } },
    ]).toArray(),
  ])

  const tcIds = teamCompAgg.map((t: any) => t.topTcId).filter(Boolean)
  const [tcs, teams] = await Promise.all([
    tcIds.length ? db.collection("teamcompetitions").find({ _id: { $in: tcIds } }, { projection: { team_id: 1 } }).toArray() : [],
    tcIds.length ? db.collection("teams").find({}, { projection: { team_name: 1, image: 1 } }).toArray() : [],
  ])

  const tcToTeamId = new Map<string, unknown>()
  for (const tc of tcs) tcToTeamId.set(tc._id.toString(), tc.team_id)
  const teamMap = new Map<string, { name: string; image: string | null }>()
  for (const t of teams) teamMap.set(t._id.toString(), { name: t.team_name ?? "", image: t.image ?? null })

  const playerTcMap = new Map<string, { tcId: string; position: string }>()
  for (const pt of teamCompAgg) {
    const pid = pt._id?.toString?.() ?? pt._id
    playerTcMap.set(pid, { tcId: pt.topTcId?.toString?.() ?? pt.topTcId, position: pt.position || "" })
  }

  const eligibleMap = new Map(eligible.map((e) => [e._id.toString(), e]))

  const playersByName = new Map(players.map((p) => [(p.player_name ?? "").trim(), p]))

  cachedCandidates = players
    .map((p) => {
      const display = (p.player_name ?? "").trim()
      const normalized = normalizeName(display)
      if (normalized.length < 3 || normalized.length > 20) return null
      const pid = p._id.toString()
      const elEntry = eligibleMap.get(pid)
      const ptInfo = playerTcMap.get(pid)
      const teamId = ptInfo?.tcId ? tcToTeamId.get(ptInfo.tcId)?.toString() : null
      const teamInfo = teamId ? teamMap.get(teamId) : null
      return {
        display,
        normalized,
        playerId: p._id,
        country: p.country ?? null,
        teamName: teamInfo?.name ?? null,
        teamImage: teamInfo?.image ?? null,
        position: ptInfo?.position || elEntry?.topPosition || null,
      }
    })
    .filter((c): c is CandidateEntry => c !== null)
    .sort((a, b) => a.normalized.localeCompare(b.normalized))

  candidateCacheTime = now
  writeMeta(db, PCAND_META_ID, cachedCandidates)
  return cachedCandidates
}

export function getPracticeHint(candidate: CandidateEntry, type: string) {
  switch (type) {
    case "team": return { teamName: candidate.teamName, teamImage: candidate.teamImage }
    case "country": return { country: candidate.country }
    case "position": return { position: candidate.position }
    default: return null
  }
}
