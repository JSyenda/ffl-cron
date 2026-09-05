import type { Env } from "../../lib/env"
import { getMongoDb, getCachedDb } from "../../lib/mongodb"
import { getDailyAnswer } from "../../lib/wordle"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const url = new URL(request.url)
  const dateKey = url.searchParams.get("dateKey")
  if (!dateKey) return json({ error: "Missing dateKey" }, 400)

  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const todayKey = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
  if (dateKey > todayKey) return json({ error: "Not found" }, 404)

  const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
  const daily = await getDailyAnswer(db, dateKey)
  return json({ dateKey: daily.dateKey, answerDisplay: daily.answerDisplay, length: daily.answerLength })
}
