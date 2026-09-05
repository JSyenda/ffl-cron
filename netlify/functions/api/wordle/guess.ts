import type { Env } from "../../lib/env"
import { getSessionFromRequest } from "../../lib/auth"
import { getMongoDb, getCachedDb, getPlayerNameMap } from "../../lib/mongodb"
import { getDailyAnswer } from "../../lib/wordle"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

const MAX_GUESSES = 6
const WORDLE_REWARD = 50
const WORDLE_VERSION = 4

function normalizeName(v: string) { return v.toLowerCase().replace(/[^a-z0-9!'.#@\-_()?:|/+*&<>,^]/g, "") }

function toMadridDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}

type LetterStatus = "correct" | "present" | "absent"

function evaluateGuess(answer: string, guess: string): LetterStatus[] {
  const result: LetterStatus[] = Array.from({ length: guess.length }, () => "absent")
  const a = answer.split("")
  const g = guess.split("")
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) { result[i] = "correct"; a[i] = "*"; g[i] = "_" }
  }
  for (let i = 0; i < g.length; i++) {
    if (g[i] === "_") continue
    const idx = a.indexOf(g[i])
    if (idx !== -1) { result[i] = "present"; a[idx] = "*" }
  }
  return result
}

export const onRequestPost: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const session = await getSessionFromRequest(env.SESSIONS, request)
  if (!session?.discordId) return json({ error: "Unauthorized" }, 401)

  let payload: { guess?: string } | null = null
  try {
    payload = (await request.json()) as { guess?: string } | null
  } catch {
    return json({ error: "Invalid request body" }, 400)
  }
  const rawGuess = (payload?.guess ?? "").trim()
  if (!rawGuess) return json({ error: "Missing guess" }, 400)

  const guessNormalized = normalizeName(rawGuess)
  if (!guessNormalized || guessNormalized.length < 2) return json({ error: "Invalid guess" }, 400)

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)

  const nameMap = await getPlayerNameMap(db)
  if (!nameMap.has(guessNormalized)) return json({ error: "Este no es el nombre de un jugador válido", valid: false }, 400)

  const user = await db.collection("users").findOne(
    { discordId: session.discordId },
    { projection: { _id: 1, betballCoins: 1 } }
  )
  if (!user?._id) return json({ error: "User not found" }, 404)

  const dateKey = toMadridDateKey()
  const daily = await getDailyAnswer(db, dateKey)
  const answerNormalized = daily.answerNormalized
  const answerDisplay = daily.answerDisplay

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

  let doc = await db.collection("wordleresults").findOne({ dateKey, userId: user._id })

  if (!doc) {
    await db.collection("wordleresults").insertOne({
      dateKey, version: WORDLE_VERSION, userId: user._id, discordId: user.discordId,
      discordName: session.discordName ?? null, discordAvatar: session.image ?? null,
      attempts: 0, solved: false,
    })
    doc = await db.collection("wordleresults").findOne({ dateKey, userId: user._id })
  }
  if (!doc) return json({ error: "Failed to create result" }, 500)

  if (doc.completedAt) return json({ error: "Juego ya completado", completed: true }, 400)
  if ((doc.attempts ?? 0) >= MAX_GUESSES) return json({ error: "Sin intentos", completed: true }, 400)

  const guessHistory = (doc.guessHistory ?? []) as string[]
  const alreadyGuessed = guessHistory.some((g) => normalizeName(g) === guessNormalized)
  if (alreadyGuessed) return json({ error: "Ya usaste ese nombre", valid: false }, 400)

  const evaluation = evaluateGuess(answerNormalized, guessNormalized)
  const solved = guessNormalized === answerNormalized
  const newAttempts = (doc.attempts ?? 0) + 1
  const completed = solved || newAttempts >= MAX_GUESSES

  const updateSet: Record<string, unknown> = {
    attempts: newAttempts,
    discordName: session.discordName ?? null,
    discordAvatar: session.image ?? null,
  }
  if (solved) updateSet.solved = true
  if (completed) updateSet.completedAt = doc.completedAt ?? new Date()

  const updateOps: Record<string, unknown> = {
    $set: updateSet,
    $push: { guessHistory: rawGuess },
  }

  await db.collection("wordleresults").updateOne({ _id: doc._id }, updateOps)

  let rewardGranted = false
  if (solved && !doc.rewardGrantedAt) {
    const grantResult = await db.collection("wordleresults").findOneAndUpdate(
      { _id: doc._id, rewardGrantedAt: { $exists: false } },
      { $set: { rewardGrantedAt: new Date(), rewardAmount: WORDLE_REWARD } }
    )
    if (grantResult) {
      await db.collection("users").updateOne(
        { _id: user._id, betballCoins: { $gte: 0 } },
        { $inc: { betballCoins: WORDLE_REWARD } }
      )
      rewardGranted = true
    }
  }

  return json({
    valid: true,
    evaluation,
    solved,
    attempts: newAttempts,
    completed,
    rewardGranted,
    answerDisplay: completed ? answerDisplay : undefined,
  })
}
