# FFL refresh — free scheduled data loop (Netlify, no GitHub Actions)

`functions/ffl-refresh.mjs` runs every 5 min on Netlify's free tier
(scheduled functions work on all plans, 30s limit, manual "Run now" button)
and replaces the data half of the old Actions workflow for $0/month:

1. Fingerprints MongoDB (latest `_id` of players, playermatchstats, goals,
   eloplayers, competitions, profilerolepoints, betballslips, tierlists +
   matches scores/states digest). Cheap: ~10 small queries, ~2-4s.
2. If betball fixtures changed → rebuilds `data/betball.json` and uploads it
   to the R2 bucket (runtime source for `/betball` once the site reads from
   R2 — phase 2).
3. If core data changed (debounced: min 1h between builds, max 8/day) →
   calls the Pages Deploy Hook so the site rebuilds fully fresh
   (`export-all` + all generators run in the Pages build via `build:pages`).

Heavy jobs (match details, ideal7, boards, export-all) stay in the Pages
build on purpose: a cron function must finish in 30s and stay cheap.

## Setup (browser only, no CLI, ~20 min)

### 1. Netlify site (free, no card needed)
1. Sign up at netlify.com → **Add new site → Import an existing project** →
   GitHub → `JSyenda/ffl-full`.
2. Build settings: command `echo ok`, publish directory `site`,
   functions directory `functions` (all prefilled from `netlify.toml` —
   just verify). This repo contains no framework code, so Netlify deploys
   it as-is with zero plugins.
3. Deploy. Open **Functions** → `ffl-refresh` shows a **Scheduled** badge
   with the next run time.

### 2. R2 bucket (Cloudflare dashboard)
1. **R2 Object Storage** → Create bucket `ffl-data`.
2. **Manage R2 API Tokens** → Create token with **Object Read & Write**
   scoped to `ffl-data`. Copy: Account ID, Access Key ID, Secret.
3. Bucket **Settings** → **Public access** → enable (note the
   `https://pub-xxx.r2.dev` URL).
4. Same page → **CORS policy**: allow `GET` from
   `https://futsalfusionleague.pages.dev` (needed in phase 2).

### 3. Env vars (Netlify site → Settings → Environment variables)
- `MONGODB_URI` — same value as the GitHub secret.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET=ffl-data`.
- `DEPLOY_HOOK_URL` — Pages project → Settings → Builds → Deploy Hook
  (create one for `main`). Optional until Pages↔GitHub is connected; without
  it the function logs "hook disabled" and still refreshes betball→R2.
- Optional: `HOOK_MIN_INTERVAL_MS` (default `3600000`),
  `HOOK_MAX_PER_DAY` (default `8`).

### 4. Verify (no CLI)
Functions → `ffl-refresh` → **Run now** → check **Logs**, then check the R2
bucket: `data/betball.json` + `data/fingerprints.json` must exist. The next
scheduled ticks only rewrite files when data actually changed.

## Offline tests (no credentials)

```bash
npm install   # once, for the offline tests
node tests/test-refresh.mjs
```

29 checks: fixtures build (mixed ObjectId/numeric ids), deterministic
output, idempotent skip, change detection, hook gating/debounce/daily cap,
tierlists fallback name, timeout guard.

## Notes
- Atlas needs NO changes (no Data API — it was sunset by MongoDB in 2025;
  the driver connects from Netlify exactly like it did from Actions, so the
  existing `0.0.0.0/0` network rule already covers it).
- Every push to `main` redeploys this Netlify placeholder too (seconds,
  harmless).
