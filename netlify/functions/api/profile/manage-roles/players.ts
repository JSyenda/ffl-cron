import type { Env } from "../../../lib/env"
import { getSessionFromRequest } from "../../../lib/auth"
import { getCachedDb, getMongoDb } from "../../../lib/mongodb"
import { getProfileRoleManagerData } from "../../../lib/profile-service"
import { json } from "../../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  try {
    const session = await getSessionFromRequest(env.SESSIONS, request)
    if (!session?.discordId) return json({ error: "Not authenticated" }, 401)

    const url = new URL(request.url)
    const roleId = url.searchParams.get("roleId")
    const q = url.searchParams.get("q") ?? ""
    if (!roleId) return json({ players: [] })

    const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
    const data = await getProfileRoleManagerData(db, session.discordId, env, { roleId, query: q }).catch(() => null)
    if (!data) return json({ error: "Access denied" }, 403)

    return json({ players: data.searchResults })
  } catch (err) {
    console.error("Players search error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
}
