import type { Env } from "../../lib/env"
import { parseCookie } from "../../lib/auth"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const cookie = parseCookie(request.headers.get("cookie"), "session_token")
  if (!cookie) {
    return json({ user: null })
  }

  const data = await env.SESSIONS.get(`sess:${cookie}`)
  if (!data) {
    return json({ user: null })
  }

  try {
    const session = JSON.parse(data)
    return json({ user: session })
  } catch {
    return json({ user: null })
  }
}
