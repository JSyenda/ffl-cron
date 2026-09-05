import type { Env } from "../../lib/env"
import { getMongoDb, getCachedDb, getPracticeCandidates, getPracticeHint } from "../../lib/mongodb"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

function pickIndex(seed: string, max: number) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  return max ? h % max : 0
}

export const onRequestPost: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  let payload: { type?: string; answer?: string; guessedLetters?: string[] } | null = null
  try {
    payload = (await request.json()) as { type?: string; answer?: string; guessedLetters?: string[] } | null
  } catch {
    return json({ error: "Invalid request body" }, 400)
  }
  const type = payload?.type ?? ""
  const answerNormalized = payload?.answer ?? ""
  const guessedLetters = payload?.guessedLetters ?? []
  if (!answerNormalized || !type) return json({ error: "Missing data" }, 400)

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const candidates = await getPracticeCandidates(db)

  const candidate = candidates.find((c) => c.normalized === answerNormalized)
  if (!candidate) return json({ error: "Player not found" }, 404)

  if (type === "exact") {
    const idx = pickIndex(`practice:${answerNormalized}:exact`, answerNormalized.length)
    return json({ exactIndex: idx + 1, exactLetter: answerNormalized[idx]?.toUpperCase() ?? null })
  }
  if (type === "present") {
    const guessedSet = new Set(guessedLetters.map((l) => l.toLowerCase()))
    const answerChars = Array.from(answerNormalized)
    const availableIndices = answerChars
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch }) => !guessedSet.has(ch.toLowerCase()))
    if (availableIndices.length === 0) return json({ error: "No available letters" }, 400)
    const pick = availableIndices[pickIndex(`practice:${answerNormalized}:present:${[...guessedSet].sort().join(",")}`, availableIndices.length)]
    return json({ presentLetter: pick.ch.toUpperCase() })
  }

  const hint = getPracticeHint(candidate, type)
  if (!hint) return json({ error: "Invalid type" }, 400)
  return json(hint)
}
