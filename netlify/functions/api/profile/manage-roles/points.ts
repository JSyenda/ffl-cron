import type { Env } from "../../../lib/env"
import { getSessionFromRequest } from "../../../lib/auth"
import { getCachedDb, getMongoDb } from "../../../lib/mongodb"
import { setProfileRolePoints } from "../../../lib/profile-service"
import { json } from "../../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestPost: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  try {
    const session = await getSessionFromRequest(env.SESSIONS, request)
    if (!session?.discordId) return json({ error: "Not authenticated" }, 401)

    const body = (await request.json()) as { roleId?: string; points?: number }
    if (!body.roleId) return json({ error: "Missing roleId" }, 400)

    const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)
    await setProfileRolePoints(db, session.discordId, body.roleId, Number(body.points ?? 0), env)
    return json({ ok: true, points: body.points ?? 0 })
  } catch (err) {
    console.error("Set role points error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
}
