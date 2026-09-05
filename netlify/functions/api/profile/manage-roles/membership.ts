import type { Env } from "../../../lib/env"
import { getSessionFromRequest } from "../../../lib/auth"
import { getCachedDb, getMongoDb } from "../../../lib/mongodb"
import { assignProfileRoleToPlayer, removeProfileRoleFromPlayer, invalidateProfileCache } from "../../../lib/profile-service"
import { json } from "../../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestPost: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  try {
    const session = await getSessionFromRequest(env.SESSIONS, request)
    if (!session?.discordId) return json({ error: "Not authenticated" }, 401)

    const body = (await request.json()) as { roleId?: string; playerObjectId?: string; op?: string }
    if (!body.roleId || !body.playerObjectId || !body.op) {
      return json({ error: "Missing parameters" }, 400)
    }

    const db = getCachedDb() ?? await getMongoDb(env.MONGODB_URI)

    if (body.op === "assign") {
      await assignProfileRoleToPlayer(db, session.discordId, body.roleId, body.playerObjectId, env)
    } else if (body.op === "remove") {
      await removeProfileRoleFromPlayer(db, session.discordId, body.roleId, body.playerObjectId)
    } else {
      return json({ error: "Invalid operation" }, 400)
    }

    invalidateProfileCache()

    return json({ ok: true })
  } catch (err) {
    console.error("Membership error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
}
