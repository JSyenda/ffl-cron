import type { Env } from "./lib/env"
import { getMongoKv, type MongoKV } from "./lib/mongo-kv"

import { onRequestGet as authSessionGet } from "./api/auth/session"
import { onRequestGet as authSignoutGet } from "./api/auth/signout"
import { onRequestGet as authSigninDiscordGet } from "./api/auth/signin/discord"
import { onRequestGet as authCallbackDiscordGet } from "./api/auth/callback/discord"
import { onRequestGet as profileGet } from "./api/profile/index"
import { onRequestGet as profilePlayerGet } from "./api/profile/[playerId]"
import { onRequestGet as manageRolesGet } from "./api/profile/manage-roles/index"
import { onRequestPost as manageRolesMembershipPost } from "./api/profile/manage-roles/membership"
import { onRequestGet as manageRolesPlayersGet } from "./api/profile/manage-roles/players"
import { onRequestPost as manageRolesPointsPost } from "./api/profile/manage-roles/points"
import { onRequestPost as tttChallengePost } from "./api/tictactoe/challenge"
import { onRequestPost as tttChallengeRespondPost } from "./api/tictactoe/challenge/respond"
import { onRequestGet as tttGameGet, onRequestPost as tttGamePost } from "./api/tictactoe/game/[gameId]"
import { onRequestPost as tttGameLeavePost } from "./api/tictactoe/game/[gameId]/leave"
import { onRequestGet as tttLeaderboardGet } from "./api/tictactoe/leaderboard"
import { onRequestPost as tttOnlinePost } from "./api/tictactoe/online"
import { onRequestGet as wordleDailyGet } from "./api/wordle/daily"
import { onRequestPost as wordleGuessPost } from "./api/wordle/guess"
import { onRequestPost as wordleHintPost } from "./api/wordle/hint"
import { onRequestGet as wordleLeaderboardGet } from "./api/wordle/leaderboard"
import { onRequestPost as wordlePracticeHintPost } from "./api/wordle/practice-hint"
import { onRequestGet as wordlePracticeGet } from "./api/wordle/practice"
import { onRequestGet as wordleStatusGet } from "./api/wordle/status"
import { onRequestPost as wordleSubmitPost } from "./api/wordle/submit"
import { onRequestGet as wordleValidateGet } from "./api/wordle/validate"

type Ctx = {
  request: Request
  env: Env
  params: Record<string, string>
  waitUntil: (p: Promise<unknown>) => void
}

type Handler = (ctx: Ctx) => Promise<Response> | Response

// Longer / more specific patterns first (manage-roles before :playerId,
// challenge/respond before challenge, game/:id/leave before game/:id).
const routes: Array<{ method: string; pattern: RegExp; keys: string[]; handler: Handler }> = [
  { method: "GET", pattern: /^\/api\/auth\/session$/, keys: [], handler: authSessionGet as Handler },
  { method: "GET", pattern: /^\/api\/auth\/signout$/, keys: [], handler: authSignoutGet as Handler },
  { method: "GET", pattern: /^\/api\/auth\/signin\/discord$/, keys: [], handler: authSigninDiscordGet as Handler },
  { method: "GET", pattern: /^\/api\/auth\/callback\/discord$/, keys: [], handler: authCallbackDiscordGet as Handler },
  { method: "GET", pattern: /^\/api\/profile\/manage-roles$/, keys: [], handler: manageRolesGet as Handler },
  { method: "POST", pattern: /^\/api\/profile\/manage-roles\/membership$/, keys: [], handler: manageRolesMembershipPost as Handler },
  { method: "GET", pattern: /^\/api\/profile\/manage-roles\/players$/, keys: [], handler: manageRolesPlayersGet as Handler },
  { method: "POST", pattern: /^\/api\/profile\/manage-roles\/points$/, keys: [], handler: manageRolesPointsPost as Handler },
  { method: "GET", pattern: /^\/api\/profile$/, keys: [], handler: profileGet as Handler },
  { method: "GET", pattern: /^\/api\/profile\/([^/]+)$/, keys: ["playerId"], handler: profilePlayerGet as Handler },
  { method: "POST", pattern: /^\/api\/tictactoe\/challenge\/respond$/, keys: [], handler: tttChallengeRespondPost as Handler },
  { method: "POST", pattern: /^\/api\/tictactoe\/challenge$/, keys: [], handler: tttChallengePost as Handler },
  { method: "POST", pattern: /^\/api\/tictactoe\/game\/([^/]+)\/leave$/, keys: ["gameId"], handler: tttGameLeavePost as Handler },
  { method: "GET", pattern: /^\/api\/tictactoe\/game\/([^/]+)$/, keys: ["gameId"], handler: tttGameGet as Handler },
  { method: "POST", pattern: /^\/api\/tictactoe\/game\/([^/]+)$/, keys: ["gameId"], handler: tttGamePost as Handler },
  { method: "GET", pattern: /^\/api\/tictactoe\/leaderboard$/, keys: [], handler: tttLeaderboardGet as Handler },
  { method: "POST", pattern: /^\/api\/tictactoe\/online$/, keys: [], handler: tttOnlinePost as Handler },
  { method: "GET", pattern: /^\/api\/wordle\/daily$/, keys: [], handler: wordleDailyGet as Handler },
  { method: "POST", pattern: /^\/api\/wordle\/guess$/, keys: [], handler: wordleGuessPost as Handler },
  { method: "POST", pattern: /^\/api\/wordle\/hint$/, keys: [], handler: wordleHintPost as Handler },
  { method: "GET", pattern: /^\/api\/wordle\/leaderboard$/, keys: [], handler: wordleLeaderboardGet as Handler },
  { method: "POST", pattern: /^\/api\/wordle\/practice-hint$/, keys: [], handler: wordlePracticeHintPost as Handler },
  { method: "GET", pattern: /^\/api\/wordle\/practice$/, keys: [], handler: wordlePracticeGet as Handler },
  { method: "GET", pattern: /^\/api\/wordle\/status$/, keys: [], handler: wordleStatusGet as Handler },
  { method: "POST", pattern: /^\/api\/wordle\/submit$/, keys: [], handler: wordleSubmitPost as Handler },
  { method: "GET", pattern: /^\/api\/wordle\/validate$/, keys: [], handler: wordleValidateGet as Handler },
]

let kvSingleton: { uri: string; kv: MongoKV } | null = null

function buildEnv(): Env {
  const g = (k: string) => process.env[k] ?? ""
  const uri = g("MONGODB_URI")
  if (!kvSingleton || kvSingleton.uri !== uri) {
    kvSingleton = { uri, kv: getMongoKv(uri) }
  }
  return {
    SESSIONS: kvSingleton.kv,
    DISCORD_CLIENT_ID: g("DISCORD_CLIENT_ID"),
    DISCORD_CLIENT_SECRET: g("DISCORD_CLIENT_SECRET"),
    DISCORD_GUILD_ID: g("DISCORD_GUILD_ID"),
    DISCORD_BOT_TOKEN: g("DISCORD_BOT_TOKEN"),
    MONGODB_URI: uri,
    SESSION_SECRET: g("SESSION_SECRET"),
    OAUTH_REDIRECT_URI: g("OAUTH_REDIRECT_URI"),
  }
}

function normalizePath(pathname: string): string {
  let p = pathname.replace(/\/+$/, "") || "/"
  // Called directly: /.netlify/functions/api/<path>
  p = p.replace(/^\/.netlify\/functions\/api/, "") || "/"
  // Called directly without prefix or proxied short path: ensure /api base
  if (p === "/" || !p.startsWith("/api/")) {
    p = p === "/" ? "/api/" : "/api" + (p.startsWith("/") ? p : `/${p}`)
  }
  return p
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Netlify Functions 2.0 (Web-standard): receives a Request, returns a Response.
export default async (
  req: Request,
  context?: { waitUntil?: (p: Promise<unknown>) => void }
): Promise<Response> => {
  const url = new URL(req.url)
  const path = normalizePath(url.pathname)
  const method = req.method.toUpperCase()

  const pathMatch = routes.find((r) => r.pattern.test(path))
  if (!pathMatch) return json({ error: "Not found" }, 404)
  if (pathMatch.method !== method) return json({ error: "Method not allowed" }, 405)

  const m = path.match(pathMatch.pattern)
  const params: Record<string, string> = {}
  pathMatch.keys.forEach((k, i) => {
    params[k] = decodeURIComponent(m?.[i + 1] ?? "")
  })

  const ctx: Ctx = {
    request: req,
    env: buildEnv(),
    params,
    waitUntil: (p: Promise<unknown>) => {
      try {
        context?.waitUntil?.(p)
      } catch {
        // fall through
      }
      p.catch(() => {})
    },
  }

  try {
    return await pathMatch.handler(ctx)
  } catch (err) {
    console.error("api router error:", path, err)
    return json({ error: "Internal error" }, 500)
  }
}
