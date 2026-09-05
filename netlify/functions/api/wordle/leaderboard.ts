import type { Env } from "../../lib/env"
import { getMongoDb, getCachedDb } from "../../lib/mongodb"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const url = new URL(request.url)
  const dateKey = url.searchParams.get("dateKey") ?? undefined

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const todayKey = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
  const targetDate = dateKey ?? todayKey

  const results = await db.collection("wordleresults").find(
    { dateKey: targetDate, version: 4, completedAt: { $ne: null } },
    { projection: { discordId: 1, discordName: 1, discordAvatar: 1, attempts: 1, solved: 1, completedAt: 1 } }
  ).sort({ solved: -1, attempts: 1 }).toArray()

  const missingNames = results.filter((r) => !r.discordName?.trim()).map((r) => r.discordId)
  let nameByDiscord = new Map<string, string | null>()
  if (missingNames.length) {
    const users = await db.collection("users").find(
      { discordId: { $in: missingNames } },
      { projection: { discordId: 1, discordName: 1, playerId: 1 } }
    ).toArray()
    const playerIds = users.filter((u) => u.playerId).map((u) => u.playerId)
    const players = playerIds.length
      ? await db.collection("players").find({ _id: { $in: playerIds } }, { projection: { _id: 1, player_name: 1 } }).toArray()
      : []
    const pNameById = new Map(players.map((p) => [p._id.toString(), (p.player_name ?? "").trim()]))
    nameByDiscord = new Map(
      users.map((u) => [u.discordId, u.discordName?.trim() || (u.playerId ? pNameById.get(u.playerId.toString()) ?? null : null)])
    )
  }

  return json({
    dateKey: targetDate,
    results: results.map((r) => ({
      discordId: r.discordId,
      discordName: r.discordName?.trim() || nameByDiscord.get(r.discordId) || null,
      discordAvatar: r.discordAvatar ?? null,
      attempts: r.attempts,
      solved: r.solved,
      completedAt: r.completedAt ? new Date(r.completedAt).getTime() : null,
    })),
  })
}
