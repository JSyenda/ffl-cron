import type { Env } from "../../../lib/env"
import { getMongoDb, getCachedDb } from "../../../lib/mongodb"
import { syncDiscordUser, createSession } from "../../../lib/auth"
import { setCookie } from "../../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { env, request } = context
  const url = new URL(request.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return new Response("Missing code", { status: 400 })
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.OAUTH_REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) {
      return new Response("Token exchange failed", { status: 502 })
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string }
    const accessToken = tokenData.access_token
    if (!accessToken) {
      return new Response("No access token", { status: 502 })
    }

    // Fetch user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userRes.ok) {
      return new Response("Failed to fetch user", { status: 502 })
    }

    const discordUser = (await userRes.json()) as {
      id: string
      username: string
      global_name?: string | null
      avatar?: string | null
    }

    const discordId = discordUser.id
    const avatarHash = discordUser.avatar ?? null
    const image = avatarHash
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}?size=256`
      : null
    const name = discordUser.global_name || discordUser.username || null

    // Connect to MongoDB and sync user
    const db = await getMongoDb(env.MONGODB_URI)

    // Fetch guild roles + sync
    const user = await syncDiscordUser(db, discordId, image, name, env.DISCORD_GUILD_ID, env.DISCORD_BOT_TOKEN)

    // Enrich session with coins/roles from DB
    const dbUser = await db.collection("users").findOne({ discordId })

    // Create KV session
    const sessionData = {
      discordId,
      name: name,
      image,
      betballCoins: Number(dbUser?.betballCoins ?? 100),
      fantasyCoins: Number(dbUser?.fantasyCoins ?? 10000),
      playerId: dbUser?.playerId?.toString() ?? null,
      roles: (dbUser?.roles ?? []) as Array<{ id: string; name: string }>,
      discordName: (dbUser?.discordName as string) ?? name,
    }

    const token = await createSession(env.SESSIONS, sessionData)

    const isSecure = url.protocol === "https:"

    const redirectUrl = `${url.protocol}//${url.host}/`

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "Set-Cookie": setCookie("session_token", token, 30 * 24 * 60 * 60, isSecure),
      },
    })
  } catch (err) {
    console.error("OAuth callback error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return new Response("Internal error: " + msg, { status: 500 })
  }
}
