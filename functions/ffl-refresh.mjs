/**
 * FFL refresh — Netlify Scheduled Function (free tier), runs every 5 min.
 *
 * Replaces the GitHub Actions data loop for $0/month:
 *  1. Computes a tiny fingerprint of the MongoDB data (latest _ids of the
 *     core collections + matches scores/states digest).
 *  2. If betball fixtures changed -> rebuilds data/betball.json and uploads
 *     it to the KV namespace (runtime source for /betball once the site
 *     reads from the reader Worker; see README).
 *  3. If core data changed (debounced: min 1h between builds, max 8/day) ->
 *     calls the Pages Deploy Hook so the site rebuilds fully fresh
 *     (export-all + all generators run in the Pages build via build:pages).
 *
 * Heavy jobs (match details, ideal7, boards, export-all) intentionally stay
 * in the Pages build: this function must finish within the 30s scheduled
 * limit, so it only does small queries + the fixtures assembly (~2-4s).
 *
 * Env vars (Netlify site settings, browser UI only):
 *   MONGODB_URI, CF_ACCOUNT_ID, CF_API_TOKEN, KV_NAMESPACE_ID,
 *   DEPLOY_HOOK_URL (optional until Pages is connected),
 *   HOOK_MIN_INTERVAL_MS (default 3600000), HOOK_MAX_PER_DAY (default 8)
 */
import { MongoClient, ObjectId } from "mongodb";

export const config = { schedule: "*/5 * * * *" };

const TIME_BUDGET_MS = 25000;
const FINGERPRINT_COLLECTIONS = [
  "players",
  "playermatchstats",
  "goals",
  "eloplayers",
  "competitions",
  "profilerolepoints",
  "betballslips",
];
const DEFAULT_HOOK_MIN_INTERVAL_MS = 3600000;
const DEFAULT_HOOK_MAX_PER_DAY = 8;

// ---------------------------------------------------------------------------
// Pure helpers (ported from scripts/generate-betball.js)
// ---------------------------------------------------------------------------
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function oid(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v.toString === "function") return v.toString();
  return "";
}
function pickString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeTeamImageUrl(image) {
  if (typeof image !== "string") return "";
  const trimmed = image.trim();
  return trimmed.startsWith("data:image") ? "" : trimmed;
}
function isOidVal(v) {
  return v !== null && v !== undefined && typeof v === "object";
}
function extractMatchdayFromComments(comments) {
  const m = comments?.match(/MD\s*0*(\d+)/i);
  return m ? Number.parseInt(m[1], 10) : null;
}
function toSafeIsoDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}
function hasCompleteMatchScore(match) {
  return Number.isFinite(Number(match?.score_team1)) && Number.isFinite(Number(match?.score_team2));
}
function toOdds(probability) {
  const safe = Math.min(0.88, Math.max(0.08, probability));
  return Math.round((1.08 / safe) * 100) / 100;
}
function buildOdds(homeStrength, awayStrength, homeWinRate = 0.5, awayWinRate = 0.5, homePlayerWinRate = 0.5, awayPlayerWinRate = 0.5) {
  const diff = homeStrength - awayStrength + (homeWinRate - awayWinRate) * 1.2 + (homePlayerWinRate - awayPlayerWinRate) * 0.8;
  const homeBase = 1.18 + Math.max(-0.42, Math.min(0.42, diff * 0.34));
  const awayBase = 1.18 - Math.max(-0.42, Math.min(0.42, diff * 0.34));
  const drawBase = 0.94 - Math.min(0.32, Math.abs(diff) * 0.18);
  const total = homeBase + awayBase + drawBase;
  return { home: toOdds(homeBase / total), draw: toOdds(drawBase / total), away: toOdds(awayBase / total) };
}
function getCompetitionStrength(row) {
  const matchesPlayed = Math.max(1, Number(row?.matches_played ?? 0));
  return (
    (Number(row?.points ?? 0) / matchesPlayed) * 0.7 +
    ((Number(row?.goals_scored ?? 0) - Number(row?.goals_conceded ?? 0)) / matchesPlayed) * 0.55 +
    (Number(row?.shots_on_goal ?? 0) / matchesPlayed) * 0.18 +
    ((Number(row?.possession_avg ?? 50) - 50) / 10) * 0.12
  );
}
function pickKitImage(kits) {
  if (!Array.isArray(kits)) return "";
  for (const entry of kits) {
    if (!entry) continue;
    const n = normalizeTeamImageUrl(typeof entry === "string" ? entry : entry.image ?? "");
    if (n) return n;
  }
  return "";
}
function getCompetitionSeasonNumber(c) {
  return Number(c.season ?? c.year ?? 0);
}
function getBetBallCompetitionLabel(c) {
  const season = getCompetitionSeasonNumber(c);
  const name = c.name?.trim();
  if (c.type === "league") return `Season ${season}${c.division ? ` · Division ${c.division}` : ""}`;
  if (c.type === "cup" || c.type === "supercup")
    return `Season ${season}${name ? ` · ${name}` : ` · ${c.type === "cup" ? "Cup" : "Supercup"}`}`;
  return name || `Season ${season}`;
}
function getBetBallCompetitionSortValue(c) {
  const typeOrder = c.type === "league" ? 0 : c.type === "cup" ? 1 : c.type === "supercup" ? 2 : 3;
  return typeOrder * 100 + Number(c.division ?? 99);
}
function resolveTeam(teamId, teamByObjectId, teamByNumericId) {
  if (teamId === null || teamId === undefined) return null;
  return isOidVal(teamId) ? teamByObjectId.get(oid(teamId)) ?? null : teamByNumericId.get(String(teamId)) ?? null;
}

// Builds the exact betball.json payload (same shape as scripts/generate-betball.js).
function buildBetballPayload(competitions, teamCompetitions, teams, matches, matchStates) {
  const teamByObjectId = new Map(teams.map((t) => [oid(t._id), t]));
  const teamByNumericId = new Map(
    teams.filter((t) => t.team_id !== null && t.team_id !== undefined).map((t) => [String(t.team_id), t])
  );
  const tcInfoById = new Map(
    teamCompetitions.map((item) => {
      const team = resolveTeam(item.team_id, teamByObjectId, teamByNumericId);
      return [
        oid(item._id),
        {
          teamName: team?.team_name ?? "Unknown team",
          teamImage: normalizeTeamImageUrl(team?.image),
          teamKit: pickKitImage(item.kits),
          teamKitTextColor: item.textColor ?? "",
          strength: getCompetitionStrength(item),
        },
      ];
    })
  );
  const closedMatchIds = new Set(matchStates.filter((s) => s.bettingClosedAt).map((s) => oid(s.matchId)));
  const competitionMap = new Map(
    competitions.map((c) => [
      oid(c._id),
      {
        id: oid(c._id),
        competitionId: c.competition_id,
        name: pickString(c.name) || getBetBallCompetitionLabel(c),
        label: getBetBallCompetitionLabel(c),
        season: getCompetitionSeasonNumber(c),
        division: c.division ?? null,
        weeks: [],
      },
    ])
  );
  const weekMaps = new Map();
  for (const match of matches) {
    const competitionKey = oid(match.competition_id);
    const competition = competitionMap.get(competitionKey);
    if (!competition) continue;
    const matchday = extractMatchdayFromComments(match.comments);
    const week = matchday && matchday > 0 ? Math.ceil(matchday / 2) : 1;
    const matchdayLabel = matchday ? `MD${matchday}` : "No matchday";
    if (!weekMaps.has(competitionKey)) weekMaps.set(competitionKey, new Map());
    const weekMap = weekMaps.get(competitionKey);
    if (!weekMap.has(week)) weekMap.set(week, { week, label: `Week ${week}`, matchdays: [] });
    const weekEntry = weekMap.get(week);
    let mdEntry = weekEntry.matchdays.find((e) => e.matchday === matchday);
    if (!mdEntry) {
      mdEntry = { label: matchdayLabel, matchday, matches: [] };
      weekEntry.matchdays.push(mdEntry);
      weekEntry.matchdays.sort((a, b) => (a.matchday ?? 999) - (b.matchday ?? 999));
    }
    const team1 = match.team1_competition_id ? tcInfoById.get(oid(match.team1_competition_id)) : null;
    const team2 = match.team2_competition_id ? tcInfoById.get(oid(match.team2_competition_id)) : null;
    const finished = hasCompleteMatchScore(match);
    const bettingClosed = finished || closedMatchIds.has(oid(match._id));
    mdEntry.matches.push({
      id: oid(match._id),
      matchId: match.match_id,
      week,
      matchday,
      matchdayLabel,
      date: toSafeIsoDate(match.date),
      team1Name: team1?.teamName ?? "TBD",
      team1Image: team1?.teamImage ?? "",
      team2Name: team2?.teamName ?? "TBD",
      team2Image: team2?.teamImage ?? "",
      scoreTeam1: Number(match.score_team1 ?? 0),
      scoreTeam2: Number(match.score_team2 ?? 0),
      comments: match.comments ?? "",
      finished,
      bettingClosed,
      odds: buildOdds(team1?.strength ?? 0, team2?.strength ?? 0),
    });
  }
  for (const [key, weekMap] of weekMaps) {
    const competition = competitionMap.get(key);
    if (!competition) continue;
    competition.weeks = [...weekMap.values()]
      .sort((a, b) => a.week - b.week)
      .map((w) => ({
        ...w,
        matchdays: w.matchdays.map((md) => ({ ...md, matches: md.matches.sort((a, b) => a.matchId - b.matchId) })),
      }));
  }
  return [...competitionMap.values()];
}

// ---------------------------------------------------------------------------
// Refresh orchestration (injectable deps so the offline harness can stub them)
// ---------------------------------------------------------------------------
function splitTeamKeys(strKeys) {
  const objectIds = [];
  const numerics = [];
  for (const key of strKeys) {
    if (/^[0-9a-fA-F]{24}$/.test(key)) objectIds.push(key);
    else if (/^\d+$/.test(key)) numerics.push(key);
  }
  return { objectIds, numerics };
}

async function latestId(db, collection) {
  const docs = await db.collection(collection).find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1).toArray();
  return docs.length ? oid(docs[0]._id) : "";
}

async function resolveTierlistsCollection(db) {
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  if (names.includes("tierlists")) return "tierlists";
  if (names.includes("tierlist")) return "tierlist";
  return "tierlists";
}

async function runRefresh({ db, storeGetJson, storePutJson, postHook, hookCfg = {}, nowMs = Date.now(), log = console.log }) {
  const t0 = nowMs();
  const out = { ok: true, log: [], betballUploaded: false, hookFired: false, timedOut: false };
  const say = (m) => { out.log.push(m); try { log(m); } catch {} };
  const elapsed = () => nowMs() - t0;
  const prev = (await storeGetJson("data/fingerprints.json")) || {};

  // 1. Latest-season competitions.
  const leagues = await db.collection("competitions").find({ type: "league" }, { projection: { season: 1, year: 1, season_id: 1 } }).toArray();
  if (!leagues.length) {
    await storePutJson("data/betball.json", []);
    const fp = { ...prev, betball: fnv1a("[]"), updatedAt: new Date(t0).toISOString() };
    await storePutJson("data/fingerprints.json", fp);
    out.fingerprints = fp;
    return out;
  }
  const highestSeason = leagues.reduce((m, c) => Math.max(m, getCompetitionSeasonNumber(c)), 0);
  const latestSeasonIds = [...new Set(leagues.filter((c) => getCompetitionSeasonNumber(c) === highestSeason).map((c) => c.season_id).filter(Boolean))];
  const seasonComps = await db.collection("competitions").find(
    { type: { $in: ["league", "cup", "supercup"] } },
    { projection: { _id: 1, competition_id: 1, type: 1, name: 1, season: 1, year: 1, season_id: 1, division: 1 } }
  ).toArray();
  const competitions = seasonComps
    .filter((c) => getCompetitionSeasonNumber(c) === highestSeason || (c.season_id && latestSeasonIds.includes(c.season_id)))
    .sort((a, b) => getBetBallCompetitionSortValue(a) - getBetBallCompetitionSortValue(b) || getBetBallCompetitionLabel(a).localeCompare(getBetBallCompetitionLabel(b)));
  const competitionIds = competitions.map((c) => c._id);

  // 2. Fixtures inputs.
  const teamCompetitions = await db.collection("teamcompetitions").find(
    { competition_id: { $in: competitionIds } },
    { projection: { _id: 1, competition_id: 1, team_id: 1, points: 1, matches_played: 1, goals_scored: 1, goals_conceded: 1, possession_avg: 1, shots_on_goal: 1, kits: 1, textColor: 1 } }
  ).toArray();
  const rawTeamKeys = [...new Set(teamCompetitions.map((t) => (t.team_id === null || t.team_id === undefined ? null : String(t.team_id))).filter(Boolean))];
  const { objectIds: oidKeys, numerics: numKeys } = splitTeamKeys(rawTeamKeys);
  const teams = oidKeys.length || numKeys.length
    ? await db.collection("teams").find(
        { $or: [...(oidKeys.length ? [{ _id: { $in: oidKeys.map((s) => new ObjectId(s)) } }] : []), ...(numKeys.length ? [{ team_id: { $in: numKeys.map(Number) } }] : [])] },
        { projection: { _id: 1, team_id: 1, team_name: 1, image: 1, kits: 1, textColor: 1 } }
      ).toArray()
    : [];
  const matches = await db.collection("matches").find(
    { competition_id: { $in: competitionIds } },
    { projection: { competition_id: 1, match_id: 1, date: 1, comments: 1, team1_competition_id: 1, team2_competition_id: 1, score_team1: 1, score_team2: 1 } }
  ).sort({ date: 1, match_id: 1 }).toArray();
  const matchStates = matches.length
    ? await db.collection("betballmatchstates").find({ matchId: { $in: matches.map((m) => m._id) } }, { projection: { matchId: 1, bettingClosedAt: 1 } }).toArray()
    : [];

  if (elapsed() > TIME_BUDGET_MS) { out.ok = false; out.timedOut = true; say("time budget exceeded after inputs"); return out; }

  // 3. Build fixtures; upload only on change (deterministic output).
  const payload = buildBetballPayload(competitions, teamCompetitions, teams, matches, matchStates);
  const payloadJson = JSON.stringify(payload);
  const betballFp = fnv1a(payloadJson);
  if (prev.betball !== betballFp) {
    await storePutJson("data/betball.json", payload);
    out.betballUploaded = true;
    say(`betball.json uploaded (${payloadJson.length} bytes, ${matches.length} matches)`);
  } else {
    say("betball.json unchanged, skipped upload");
  }

  // 4. Core-data fingerprint -> debounced deploy hook.
  const latestIds = {};
  for (const coll of FINGERPRINT_COLLECTIONS) latestIds[coll] = await latestId(db, coll);
  latestIds.tierlists = await latestId(db, await resolveTierlistsCollection(db));
  const scoresDigest = fnv1a(matches.map((m) => `${oid(m._id)}:${m.score_team1 ?? ""}:${m.score_team2 ?? ""}`).sort().join("|"));
  const statesDigest = fnv1a(matchStates.map((s) => `${oid(s.matchId)}:${s.bettingClosedAt ? "1" : "0"}`).sort().join("|"));
  const mainFp = [...Object.values(latestIds), scoresDigest, statesDigest].join("|");

  const minInterval = Number(hookCfg.minIntervalMs ?? DEFAULT_HOOK_MIN_INTERVAL_MS);
  const maxPerDay = Number(hookCfg.maxPerDay ?? DEFAULT_HOOK_MAX_PER_DAY);
  const now = nowMs();
  const today = new Date(now).toISOString().slice(0, 10);
  const hookCount = prev.hookDay === today ? Number(prev.hookCount || 0) : 0;
  const lastHookAt = Number(prev.lastHookAt || 0);
  if (prev.main && prev.main !== mainFp) {
    if (now - lastHookAt >= minInterval && hookCount < maxPerDay) {
      try {
        await postHook();
        out.hookFired = true;
        say("deploy hook fired");
      } catch (err) {
        say(`deploy hook failed: ${String(err?.message || err).slice(0, 120)}`);
      }
    } else {
      say("main data changed but hook debounced/capped, skipped");
    }
  } else if (!prev.main) {
    say("first run: hook armed for next change");
  } else {
    say("main data unchanged");
  }

  const fp = {
    betball: betballFp,
    main: mainFp,
    updatedAt: new Date(t0).toISOString(),
    lastHookAt: out.hookFired ? now : lastHookAt,
    hookDay: today,
    hookCount: out.hookFired ? hookCount + 1 : hookCount,
    matches: matches.length,
  };
  await storePutJson("data/fingerprints.json", fp);
  out.fingerprints = fp;
  return out;
}

// ---------------------------------------------------------------------------
// Production wiring (Netlify env + Workers KV over REST API, no extra deps)
// ---------------------------------------------------------------------------
let cachedClient = null;
async function getDb(mongoUri) {
  if (!cachedClient) {
    cachedClient = new MongoClient(mongoUri);
    await cachedClient.connect();
  }
  return cachedClient.db();
}

// Minimal KV store client (Cloudflare API token with Workers KV Storage
// Read+Write on the namespace). Keys used: data/betball.json,
// data/fingerprints.json.
function makeKvStore(env) {
  const accountId = String(env.CF_ACCOUNT_ID || "").trim();
  const namespaceId = String(env.KV_NAMESPACE_ID || "").trim();
  const token = String(env.CF_API_TOKEN || "").trim();
  const looksPlaceholder = (s) => s.includes("PEGA_AQUI");
  console.log(
    `KV env sanity: accountIdLen=${accountId.length} namespaceIdLen=${namespaceId.length} ` +
    `tokenLen=${token.length} placeholders=${[accountId, namespaceId, token].some(looksPlaceholder)}`
  );
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    async getJson(key) {
      const res = await fetch(`${base}/${key}`, { headers: { Authorization: headers.Authorization } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`KV read failed (${res.status})`);
      return await res.json();
    },
    async putJson(key, value) {
      const body = typeof value === "string" ? value : JSON.stringify(value);
      const res = await fetch(`${base}/${key}`, { method: "PUT", headers, body });
      if (!res.ok) throw new Error(`KV write failed (${res.status})`);
    },
  };
}

export default async (req) => {
  const env = Netlify.env.toObject();
  const started = Date.now();
  for (const key of ["MONGODB_URI", "CF_ACCOUNT_ID", "CF_API_TOKEN", "KV_NAMESPACE_ID"]) {
    if (!env[key]) {
      const msg = `Missing ${key} env var (check site env vars + redeploy)`;
      console.error(msg);
      return new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  try {
    const db = await getDb(env.MONGODB_URI);
    const store = makeKvStore(env);
    const result = await runRefresh({
      db,
      storeGetJson: (k) => store.getJson(k),
      storePutJson: (k, v) => store.putJson(k, v),
      postHook: async () => {
        if (!env.DEPLOY_HOOK_URL) throw new Error("no DEPLOY_HOOK_URL");
        const res = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
        if (!res.ok) throw new Error(`hook responded ${res.status}`);
      },
      hookCfg: { minIntervalMs: env.HOOK_MIN_INTERVAL_MS, maxPerDay: env.HOOK_MAX_PER_DAY },
      nowMs: () => Date.now(),
      log: (...args) => console.log(...args),
    });
    return new Response(JSON.stringify({ ...result, elapsedMs: Date.now() - started }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err?.stack || err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export { fnv1a, buildBetballPayload, runRefresh, latestId, FINGERPRINT_COLLECTIONS };
