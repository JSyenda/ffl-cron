import type { MongoKV } from "./mongo-kv"

export interface Env {
  SESSIONS: MongoKV
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  DISCORD_GUILD_ID: string
  DISCORD_BOT_TOKEN: string
  MONGODB_URI: string
  SESSION_SECRET: string
  OAUTH_REDIRECT_URI: string
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

export function redirect(url: string, status = 302): Response {
  return Response.redirect(url, status)
}

export function setCookie(name: string, value: string, maxAge: number, secure = true): string {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  return `${name}=${encodeURIComponent(value)}; ${flags}${secure ? "; Secure" : ""}`
}
