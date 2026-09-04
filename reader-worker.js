/**
 * FFL betball reader — tiny Cloudflare Worker (free tier, no card needed).
 *
 * Serves the JSON written by the Netlify cron (netlify: functions/ffl-refresh)
 * from the KV namespace, so browsers can fetch it at runtime:
 *   GET https://<your-worker>.workers.dev/data/betball.json
 *
 * Setup (browser only): Workers & Pages -> Create Worker -> paste this whole
 * file in Quick Edit -> Settings -> Bindings -> KV Namespace binding with
 * variable name BETBALL_KV pointing at your namespace -> Save & Deploy.
 * No secrets, no env vars, no cron on this worker.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/data/betball.json") {
      return new Response("not found", { status: 404 });
    }
    const value = await env.BETBALL_KV.get("data/betball.json");
    if (value === null) {
      return new Response("not found", { status: 404 });
    }
    return new Response(value, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  },
};
