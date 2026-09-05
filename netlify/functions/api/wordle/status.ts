import type { Env } from "../../lib/env"
import { getSessionFromRequest } from "../../lib/auth"
import { getMongoDb, getCachedDb } from "../../lib/mongodb"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

function toMadridDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "00"
  const d = parts.find((p) => p.type === "day")?.value ?? "00"
  return `${y}-${m}-${d}`
}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const session = await getSessionFromRequest(env.SESSIONS, request)
  if (!session?.discordId) {
    return json({ error: "Unauthorized" }, 401)
  }

  const url = new URL(request.url)
  const dateKey = url.searchParams.get("dateKey") ?? toMadridDateKey()

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const user = await db.collection("users").findOne(
    { discordId: session.discordId },
    { projection: { _id: 1, betballCoins: 1 } }
  )
  if (!user?._id) {
    return json({ error: "User not found" }, 404)
  }

  const result = await db.collection("wordleresults").findOne(
    { dateKey, userId: user._id },
    {
      projection: {
        version: 1, attempts: 1, solved: 1, completedAt: 1,
        hintTeamImage: 1, hintTeamName: 1, hintExactLetter: 1, hintExactIndex: 1,
        hintPresentLetter: 1, hintCountry: 1, hintPosition: 1,
      },
    }
  )

  const WORDLE_VERSION = 4
  if (!result || result.version !== WORDLE_VERSION) {
    return json({
      betballCoins: Number(user.betballCoins ?? 0),
      completed: false,
      hints: { teamImage: null, teamName: null, exactLetter: null, exactIndex: null, presentLetter: null, country: null, position: null },
    })
  }

  return json({
    betballCoins: Number(user.betballCoins ?? 0),
    completed: Boolean(result.completedAt),
    solved: Boolean(result.solved),
    attempts: Number(result.attempts ?? 0),
    hints: {
      teamImage: result.hintTeamImage ?? null,
      teamName: result.hintTeamName ?? null,
      exactLetter: result.hintExactLetter ?? null,
      exactIndex: result.hintExactIndex ?? null,
      presentLetter: result.hintPresentLetter ?? null,
      country: result.hintCountry ?? null,
      position: result.hintPosition ?? null,
    },
  })
}
