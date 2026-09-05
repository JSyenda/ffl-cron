import type { Env } from "../../lib/env"
import { getSessionFromRequest } from "../../lib/auth"
import { getMongoDb, getCachedDb, getPlayerNameMap } from "../../lib/mongodb"
import { getDailyAnswer } from "../../lib/wordle"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

const HINT_COSTS: Record<string, number> = {
  team: 25,
  exact: 20,
  present: 15,
  country: 10,
  position: 5,
}
const WORDLE_VERSION = 4

function toMadridDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}
function pickIndex(seed: string, max: number) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  return max ? h % max : 0
}

export const onRequestPost: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const session = await getSessionFromRequest(env.SESSIONS, request)
  if (!session?.discordId) return json({ error: "Unauthorized" }, 401)

  let payload: { type?: string; guessedLetters?: string[] } | null = null
  try {
    payload = (await request.json()) as { type?: string; guessedLetters?: string[] } | null
  } catch {
    return json({ error: "Invalid request body" }, 400)
  }
  const type = payload?.type ?? ""
  const guessedLetters = payload?.guessedLetters ?? []
  const cost = HINT_COSTS[type]
  if (!cost) return json({ error: "Invalid hint" }, 400)

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const user = await db.collection("users").findOne(
    { discordId: session.discordId },
    { projection: { _id: 1, betballCoins: 1, discordId: 1, discordAvatar: 1 } }
  )
  if (!user?._id) return json({ error: "User not found" }, 404)

  const dateKey = toMadridDateKey()
  const daily = await getDailyAnswer(db, dateKey)
  const answerNormalized = daily.answerNormalized

  const nameMap = await getPlayerNameMap(db)
  const displayForAnswer = nameMap.get(answerNormalized) ?? daily.answerDisplay

  const answerPlayer = await db.collection("players").findOne(
    { player_name: displayForAnswer },
    { projection: { _id: 1, country: 1, player_name: 1 } }
  )
  if (!answerPlayer?._id) return json({ error: "Answer player not found" }, 404)

  const existing = await db.collection("wordleresults").findOne({ dateKey, userId: user._id })
  if (existing && existing.version !== WORDLE_VERSION) {
    await db.collection("wordleresults").updateOne(
      { _id: existing._id },
      { $set: { version: WORDLE_VERSION, attempts: 0, solved: false, completedAt: null,
        hintTeamImage: null, hintTeamName: null, hintExactLetter: null, hintExactIndex: null,
        hintPresentLetter: null, hintCountry: null, hintPosition: null,
        rewardGrantedAt: null, rewardAmount: null } }
    )
  }

  let resultDoc = await db.collection("wordleresults").findOne({ dateKey, userId: user._id })
  if (!resultDoc) {
    await db.collection("wordleresults").insertOne({
      dateKey, version: WORDLE_VERSION, userId: user._id, discordId: user.discordId,
      discordName: session.discordName ?? null, discordAvatar: session.image ?? null,
      attempts: 0, solved: false,
    })
    resultDoc = await db.collection("wordleresults").findOne({ dateKey, userId: user._id })
  }
  if (!resultDoc) return json({ error: "Failed" }, 500)
  if (resultDoc.completedAt) return json({ error: "Completed" }, 400)

  if (type === "team" && resultDoc.hintTeamName) return json({ ok: true, cost: 0, betballCoins: Number(user.betballCoins ?? 0), hint: { teamImage: resultDoc.hintTeamImage, teamName: resultDoc.hintTeamName } })
  if (type === "country" && resultDoc.hintCountry) return json({ ok: true, cost: 0, betballCoins: Number(user.betballCoins ?? 0), hint: { country: resultDoc.hintCountry } })
  if (type === "position" && resultDoc.hintPosition) return json({ ok: true, cost: 0, betballCoins: Number(user.betballCoins ?? 0), hint: { position: resultDoc.hintPosition } })
  if (type === "exact" && resultDoc.hintExactLetter) return json({ ok: true, cost: 0, betballCoins: Number(user.betballCoins ?? 0), hint: { exactIndex: resultDoc.hintExactIndex, exactLetter: resultDoc.hintExactLetter } })
  if (type === "present" && resultDoc.hintPresentLetter) return json({ ok: true, cost: 0, betballCoins: Number(user.betballCoins ?? 0), hint: { presentLetter: resultDoc.hintPresentLetter } })

  const deductResult = await db.collection("users").findOneAndUpdate(
    { _id: user._id, betballCoins: { $gte: cost } },
    { $inc: { betballCoins: -cost } },
    { returnDocument: "after" }
  )
  if (!deductResult) return json({ error: "Insufficient coins" }, 400)

  const newBalance = Number(deductResult.betballCoins ?? 0)
  const updateHint: Record<string, unknown> = {}
  let responseData: Record<string, unknown> = {}

  if (type === "team") {
    const comps = await db.collection("playercompetitions").find({ player_id: answerPlayer._id }, { projection: { team_competition_id: 1, matchesPlayed: 1 } }).toArray()
    const top = comps.map((c: { team_competition_id: string; matchesPlayed?: number }) => ({ id: c.team_competition_id, mp: c.matchesPlayed ?? 0 })).sort((a, b) => b.mp - a.mp)[0]
    if (top?.id) {
      const tc = await db.collection("teamcompetitions").findOne({ _id: top.id }, { projection: { team_id: 1 } })
      if (tc?.team_id) {
        const team = await db.collection("teams").findOne({ _id: tc.team_id }, { projection: { team_name: 1, image: 1 } })
        if (team) {
          updateHint.hintTeamImage = team.image ?? null
          updateHint.hintTeamName = team.team_name ?? null
          responseData = { teamImage: team.image ?? null, teamName: team.team_name ?? null }
        }
      }
    }
  }
  if (type === "country") {
    updateHint.hintCountry = answerPlayer.country ?? null
    responseData = { country: answerPlayer.country ?? null }
  }
  if (type === "position") {
    const comps = await db.collection("playercompetitions").find({ player_id: answerPlayer._id }, { projection: { position: 1, matchesPlayed: 1 } }).toArray()
    const top = comps.map((c: { position?: string; matchesPlayed?: number }) => ({ pos: c.position ?? "", mp: c.matchesPlayed ?? 0 })).filter((c) => c.pos).sort((a, b) => b.mp - a.mp)[0]
    updateHint.hintPosition = top?.pos ?? null
    responseData = { position: top?.pos ?? null }
  }
  if (type === "exact") {
    const idx = pickIndex(`${dateKey}:${user._id}:exact`, answerNormalized.length)
    updateHint.hintExactIndex = idx + 1
    updateHint.hintExactLetter = answerNormalized[idx]?.toUpperCase() ?? null
    responseData = { exactIndex: idx + 1, exactLetter: answerNormalized[idx]?.toUpperCase() ?? null }
  }
  if (type === "present") {
    const guessedSet = new Set(guessedLetters.map((l) => l.toLowerCase()))
    const answerChars = Array.from(answerNormalized)
    const availableIndices = answerChars
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch }) => !guessedSet.has(ch.toLowerCase()))
    if (availableIndices.length <= 1) return json({ error: "No hay letras disponibles para esta pista." }, 400)
    const pick = availableIndices[pickIndex(`${dateKey}:${user._id}:present:${[...guessedSet].sort().join(",")}`, availableIndices.length)]
    updateHint.hintPresentLetter = pick.ch.toUpperCase() ?? null
    responseData = { presentLetter: pick.ch.toUpperCase() ?? null }
  }

  await db.collection("wordleresults").updateOne({ _id: resultDoc._id }, { $set: updateHint })
  return json({ ok: true, cost, betballCoins: newBalance, hint: responseData })
}
