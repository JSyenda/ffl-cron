/**
 * Offline test harness for netlify-cron/functions/ffl-refresh.mjs (no credentials).
 *
 * Stubs the Mongo driver (canned docs with REAL ObjectIds/Dates/numbers),
 * the R2 store (Map) and the deploy hook, then exercises runRefresh:
 * fixtures build (incl. mixed ObjectId/numeric team_ids), deterministic
 * output, idempotent skip, change detection, hook gating + debounce + daily
 * cap, tierlists collection fallback, timeout guard.
 *
 * Run: node netlify-cron/tests/test-refresh.mjs   (from repo root)
 */
import { ObjectId } from "mongodb";
import { fnv1a, buildBetballPayload, runRefresh } from "../functions/ffl-refresh.mjs";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  PASS ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${extra}`); }
}

// ---------------------------------------------------------------- fixtures
const COMP = new ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");
const TC1 = new ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb");
const TC2 = new ObjectId("cccccccccccccccccccccccc");
const TEAM_OID = new ObjectId("dddddddddddddddddddddddd");
const TEAM2_OID = new ObjectId("eeeeeeeeeeeeeeeeeeeeeeee");
const M1 = new ObjectId("69cc4112a4ad7de7e9e1ce70");
const M2 = new ObjectId("69d8212ba4ad7de7e9e239bf");
const DAY = 86400000;
const T0 = Date.UTC(2026, 8, 1, 18, 0, 0);

const leaguesFixture = [{ _id: new ObjectId("e00000000000000000000001"), season: 9, year: 2025, season_id: "s9" }];
const compsFixture = [
  { _id: COMP, competition_id: "10000034", type: "league", name: "Div 1", season: 9, year: 2025, season_id: "s9", division: 1 },
];
const tcsFixture = [
  { _id: TC1, competition_id: COMP, team_id: TEAM_OID, points: 10, matches_played: 5, goals_scored: 20, goals_conceded: 10, possession_avg: 55.5, shots_on_goal: 30, kits: [{ image: "https://x.test/kit-a.png" }], textColor: "#FFFFFF" },
  { _id: TC2, competition_id: COMP, team_id: 12345, points: 4, matches_played: 5, goals_scored: 8, goals_conceded: 15, possession_avg: 45, shots_on_goal: 12, kits: [], textColor: "" },
];
const teamsFixture = [
  { _id: TEAM_OID, team_id: 99, team_name: "Alpha FC", image: "https://x.test/a.png" },
  { _id: TEAM2_OID, team_id: 12345, team_name: "Beta United", image: "" },
];
function matchesFixture(score2 = null) {
  const m1 = {
    _id: M1, competition_id: COMP, match_id: 1, date: new Date(T0 - DAY), comments: "MD1",
    team1_competition_id: TC1, team2_competition_id: TC2, score_team1: 2, score_team2: 1,
  };
  const m2 = {
    _id: M2, competition_id: COMP, match_id: 2, date: new Date(T0 + DAY), comments: "MD1",
    team1_competition_id: TC2, team2_competition_id: TC1,
  };
  if (score2) { m2.score_team1 = score2[0]; m2.score_team2 = score2[1]; }
  return [m1, m2];
}
const latestHex = {
  players: "f10000000000000000000001",
  playermatchstats: "f10000000000000000000002",
  goals: "f10000000000000000000003",
  eloplayers: "f10000000000000000000004",
  competitions: "f10000000000000000000005",
  profilerolepoints: "f10000000000000000000006",
  betballslips: "f10000000000000000000007",
  tierlists: "f10000000000000000000008",
};
const mutable = { matches: matchesFixture(), hookCalls: 0, latest: { ...latestHex } };

function cursor(docs) {
  return { sort: () => ({ limit: () => ({ toArray: async () => docs }), toArray: async () => docs }), toArray: async () => docs };
}
const fakeDb = {
  listCollections: () => ({ toArray: async () => [{ name: "tierlists" }] }),
  collection: (name) => ({
    find: (filter = {}, opts = {}) => {
      if (name === "competitions") {
        if (filter.type === "league") return cursor(leaguesFixture);
        return cursor(compsFixture);
      }
      if (name === "teamcompetitions") return cursor(tcsFixture);
      if (name === "teams") return cursor(teamsFixture);
      if (name === "matches") return cursor(mutable.matches);
      if (name === "betballmatchstates") return cursor([]);
      if (mutable.latest[name]) return cursor([{ _id: new ObjectId(mutable.latest[name]) }]);
      return cursor([]);
    },
  }),
};

function makeR2() {
  const store = new Map();
  return {
    store,
    puts: [],
    async getJson(k) {
      const v = store.get(k);
      return v === undefined ? null : JSON.parse(v);
    },
    async putJson(k, v) {
      store.set(k, typeof v === "string" ? v : JSON.stringify(v));
      this.puts.push(k);
    },
  };
}

const silent = () => {};
async function run({ r2, clock, hookCfg } = {}) {
  return runRefresh({
    db: fakeDb,
    storeGetJson: (k) => r2.getJson(k),
    storePutJson: (k, v) => r2.putJson(k, v),
    postHook: async () => { mutable.hookCalls += 1; },
    hookCfg: hookCfg ?? { minIntervalMs: 3600000, maxPerDay: 8 },
    nowMs: clock ?? (() => T0),
    log: silent,
  });
}

console.log("unit: fnv1a + payload");
check("deterministic", fnv1a("hello") === fnv1a("hello") && fnv1a("a") !== fnv1a("b"));
{
  const a = JSON.stringify(buildBetballPayload(compsFixture, tcsFixture, teamsFixture, mutable.matches, []));
  const b = JSON.stringify(buildBetballPayload(compsFixture, tcsFixture, teamsFixture, mutable.matches, []));
  check("payload deterministic (fingerprint-stable)", a === b);
  const p = JSON.parse(a);
  const ms = p[0].weeks[0].matchdays[0].matches;
  check("mixed id team names", ms[0].team1Name === "Alpha FC" && ms[0].team2Name === "Beta United", `${ms[0].team1Name}/${ms[0].team2Name}`);
  check("finished/closed flags", ms[0].finished && ms[0].bettingClosed && !ms[1].finished && !ms[1].bettingClosed);
  check("odds finite", [ms[0].odds.home, ms[0].odds.draw, ms[0].odds.away].every(Number.isFinite));
}

console.log("run1: cold start");
const r2 = makeR2();
{
  const res = await run({ r2 });
  check("ok", res.ok === true);
  check("betball.json uploaded", r2.puts.includes("data/betball.json"));
  check("fingerprints written", r2.puts.includes("data/fingerprints.json"));
  check("no hook on first run", mutable.hookCalls === 0);
  const bj = JSON.parse(r2.store.get("data/betball.json"));
  check("open match present", bj[0].weeks[0].matchdays[0].matches.some((m) => m.id === M2.toString() && !m.bettingClosed));
}

console.log("run2: identical (idempotent)");
{
  const before = r2.puts.length;
  const res = await run({ r2 });
  check("ok", res.ok === true);
  const fresh = r2.puts.slice(before);
  check("only fingerprints rewritten", fresh.length === 1 && fresh[0] === "data/fingerprints.json", JSON.stringify(fresh));
  check("still no hook", mutable.hookCalls === 0);
}

console.log("run3: score entered");
{
  mutable.matches = matchesFixture([3, 3]);
  const res = await run({ r2 });
  check("ok", res.ok === true);
  const bj = JSON.parse(r2.store.get("data/betball.json"));
  const m2 = bj[0].weeks[0].matchdays[0].matches.find((m) => m.id === M2.toString());
  check("new score + finished", m2.scoreTeam1 === 3 && m2.finished === true);
  check("hook fired once", mutable.hookCalls === 1, `calls=${mutable.hookCalls}`);
}

console.log("run4: immediate rerun (debounce)");
{
  const res = await run({ r2 });
  check("ok", res.ok === true);
  check("hook still once", mutable.hookCalls === 1);
}

console.log("run5: daily cap");
{
  const r2b = makeR2();
  mutable.matches = matchesFixture();
  mutable.hookCalls = 0;
  await run({ r2: r2b, hookCfg: { minIntervalMs: 0, maxPerDay: 2 } });
  check("cold start arms hook", mutable.hookCalls === 0);
  mutable.matches = matchesFixture([1, 0]);
  await run({ r2: r2b, hookCfg: { minIntervalMs: 0, maxPerDay: 2 } });
  check("first change fires", mutable.hookCalls === 1, `calls=${mutable.hookCalls}`);
  mutable.matches = matchesFixture([2, 0]);
  await run({ r2: r2b, hookCfg: { minIntervalMs: 0, maxPerDay: 2 } });
  check("second change fires (cap 2)", mutable.hookCalls === 2, `calls=${mutable.hookCalls}`);
  mutable.matches = matchesFixture([0, 2]);
  const res = await run({ r2: r2b, hookCfg: { minIntervalMs: 0, maxPerDay: 2 } });
  check("ok", res.ok === true);
  check("third change capped", mutable.hookCalls === 2, `calls=${mutable.hookCalls}`);
  check("log mentions cap", res.log.some((l) => /debounced\/capped/.test(l)), JSON.stringify(res.log));
}

console.log("run6: timeout guard");
{
  let t = T0;
  const res = await run({ r2, clock: () => (t += 30000) });
  check("timed out safely", res.ok === false && res.timedOut === true);
}

console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
process.exit(failures ? 1 : 0);
