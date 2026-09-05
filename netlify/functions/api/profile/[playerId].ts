import type { Env } from "../../lib/env"
import { getCachedDb, getMongoDb } from "../../lib/mongodb"
import { getUserProfileDataByPlayerId } from "../../lib/profile-service"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, params } = context
  const playerId = (params as Record<string, string>).playerId

  if (!playerId) {
    return json({ error: "Missing playerId" }, 400)
  }

  try {
    const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
    const profile = await getUserProfileDataByPlayerId(db, playerId)

    if (!profile) {
      return json({ error: "Profile not found" }, 404)
    }

    return json(profile)
  } catch (err) {
    console.error("Profile API error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
}
