import type { Env } from "../../lib/env"
import { json } from "../../lib/env"
import { getTttIdentity } from "../../lib/ttt"
import { setPresence, listPresence, listChallengesFor, getActiveGameId } from "../../lib/tttstore"

function withTimeout(p: Promise<any>, ms: number, label: string): Promise<any> {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout:" + label)), ms)),
  ])
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const kv = context.env.SESSIONS
    const id = await withTimeout(getTttIdentity(context.env, context.request), 5000, "getTttIdentity")
    if (!id) return json({ error: "identity required" }, 401)

    await withTimeout(setPresence(kv, id.userId, id.displayName, id.avatar ?? null), 5000, "setPresence")
    const onlineUsers = await withTimeout(listPresence(kv, id.userId), 5000, "listPresence")
    const { incoming, outgoing } = await withTimeout(listChallengesFor(kv, id.userId), 5000, "listChallengesFor")
    const activeGameId = await withTimeout(getActiveGameId(kv, id.userId), 5000, "getActiveGameId")

    return json({ onlineUsers, incoming, outgoing, activeGameId: activeGameId || null })
  } catch (err: any) {
    const msg = err && err.message ? err.message : String(err)
    console.error("ttt online error", msg)
    return json({ error: msg }, 500)
  }
}