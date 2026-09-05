import type { Env } from "../../lib/env"
import { getMongoDb, getCachedDb, getPlayerNameMap } from "../../lib/mongodb"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

function normalizeName(v: string) { return v.toLowerCase().replace(/[^a-z0-9!'.#@\-_()?:|/+*&<>,^]/g, "") }

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const url = new URL(request.url)
  const guess = url.searchParams.get("guess")
  if (!guess) return json({ valid: false })

  const normalized = normalizeName(guess)
  if (!normalized) return json({ valid: false })

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const nameMap = await getPlayerNameMap(db)

  return json({ valid: nameMap.has(normalized) })
}
