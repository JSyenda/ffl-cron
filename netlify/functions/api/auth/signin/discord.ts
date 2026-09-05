import type { Env } from "../../../lib/env"

interface PagesFunctionEnv extends Env {}

export const onRequestGet: PagesFunction<PagesFunctionEnv> = async (context) => {
  const { DISCORD_CLIENT_ID, OAUTH_REDIRECT_URI } = context.env

  const url = new URL("https://discord.com/api/oauth2/authorize")
  url.searchParams.set("client_id", DISCORD_CLIENT_ID)
  url.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "identify guilds.members.read")

  return Response.redirect(url.toString(), 302)
}
