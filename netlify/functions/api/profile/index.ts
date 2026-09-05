import type { Env } from "../../lib/env"
import { getSessionFromRequest } from "../../lib/auth"
import { getCachedDb, getMongoDb } from "../../lib/mongodb"
import { getUserProfileData } from "../../lib/profile-service"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context

  try {
    const session = await getSessionFromRequest(env.SESSIONS, request)
    if (!session?.discordId) {
      return json({ error: "Not authenticated" }, 401)
    }

    const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
    const profile = await getUserProfileData(db, session.discordId)

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
