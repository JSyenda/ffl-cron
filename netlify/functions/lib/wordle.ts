import type { Db } from "mongodb"
import { getPracticeCandidates } from "./mongodb"

function toMadridDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}

export type DailyAnswer = { dateKey: string; answerNormalized: string; answerDisplay: string; answerLength: number }

export async function getDailyAnswer(db: Db, dateKey?: string): Promise<DailyAnswer> {
  const targetDate = dateKey ?? toMadridDateKey()
  const candidates = await getPracticeCandidates(db)
  if (!candidates.length) return { dateKey: targetDate, answerNormalized: "player", answerDisplay: "Player", answerLength: 6 }
  const seed = targetDate.split("-").join("")
  const choice = candidates[Number.parseInt(seed, 10) % candidates.length]
  return { dateKey: targetDate, answerNormalized: choice.normalized, answerDisplay: choice.display, answerLength: choice.normalized.length }
}
