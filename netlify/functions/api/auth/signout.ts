import type { Env } from "../../lib/env"
import { parseCookie } from "../../lib/auth"
import { setCookie } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const cookie = parseCookie(request.headers.get("cookie"), "session_token")
  if (cookie) {
    await env.SESSIONS.delete(`sess:${cookie}`)
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": setCookie("session_token", "", 0),
    },
  })
}
