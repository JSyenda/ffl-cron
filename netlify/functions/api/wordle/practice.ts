import type { Env } from "../../lib/env"
import { getMongoDb, getCachedDb, getPracticeCandidates } from "../../lib/mongodb"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

function pickIndex(seed: string, max: number) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000
  return max ? h % max : 0
}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env } = context
  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const candidates = await getPracticeCandidates(db)
  if (!candidates.length) return json({ answer: "player", answerDisplay: "Player", length: 6 })
  const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const choice = candidates[pickIndex(seed, candidates.length)]
  return json({ answer: choice.normalized, answerDisplay: choice.display, length: choice.normalized.length })
}
