import { ObjectId, type Db } from "mongodb"

export type UserRole = {
  id: string
  name: string
}

export type ProfileStats = {
  matchesPlayed: number
  matchesWon: number
  goals: number
  assists: number
  preassists: number
  cleanSheets: number
  mvp: number
  totw: number
  kicks: number
  braces: number
  hatTricks: number
  pokers: number
  seasonsPlayed: number
  sameTeamSeasonsMax: number
  goalMinutesCovered: number
  nationsParticipations: number
  teamsPlayed: number
  versatileCoverage: number
  doubleDoubleSeasons: number
  invincibleLeagues: number
  captaincies: number
  impactSubMatches: number
  teamsOverFourMatches: number
  fullShiftMatches: number
  ownGoals: number
  doubleThreatMatches: number
  allStarTitles: number
  mercyWins: number
  comebackWins: number
  leagueTitles: number
  summerTitles: number
  rookiePlaceholder: number
  openingStrikeGoals: number
  cupTitles: number
  supercupTitles: number
  silentGeniusMatches: number
  lateHeroWins: number
  perfectStartSeasons: number
  trebleSeasons: number
  nationsTitles: number
  bigNightMatches: number
  seasonInvictos: number
  bestAwards: number
  doubleCenturyCareer: number
  championPlaceholder: number
  fusionPlaceholder: number
}

type ObjectiveDefinition = {
  key: string
  label: string
  description: string
  target: number
  stat: keyof ProfileStats
  category: string
}

export type ProfileObjective = ObjectiveDefinition & {
  current: number
  completed: boolean
}

export type UserProfileData = {
  user: {
    discordId: string
    roles: UserRole[]
    playerId: string | null
    discordAvatar?: string | null
    discordName?: string | null
  }
  player: {
    id: string
    playerId: number
    name: string
    country: string
    avatar?: string
  } | null
  stats: ProfileStats
  objectives: ProfileObjective[]
}

function createMilestoneObjectives(
  category: string,
  stat: keyof ProfileStats,
  milestones: number[],
  labelBuilder: (target: number) => string,
  descriptionBuilder: (target: number) => string
) {
  return milestones.map((target) => ({
    key: `${category.toLowerCase()}-${target}`,
    category,
    label: labelBuilder(target),
    description: descriptionBuilder(target),
    target,
    stat,
  }))
}

const objectiveDefinitions: ObjectiveDefinition[] = [
  // ── Main offensive ──────────────────────────────────────────────────────────
  ...createMilestoneObjectives(
    "Matches", "matchesPlayed", [1, 5, 10, 25, 50, 75, 100],
    (t) => t === 1 ? "Debut" : t === 5 ? "Getting Started" : t === 10 ? "Regular" : t === 25 ? "Established" : t === 50 ? "Veteran" : t === 75 ? "Mainstay" : "Centurion",
    (t) => t === 1 ? "Play your first official match." : t === 5 ? "Play 5 official matches." : t === 10 ? "Play 10 official matches." : t === 25 ? "Play 25 official matches." : t === 50 ? "Play 50 official matches." : t === 75 ? "Play 75 official matches." : "Play 100 official matches."
  ),
  ...createMilestoneObjectives(
    "Goals", "goals", [1, 5, 10, 25, 50, 100, 250],
    (t) => t === 1 ? "First Strike" : t === 5 ? "Finisher" : t === 10 ? "Goalscorer" : t === 25 ? "Striker" : t === 50 ? "Sharpshoot" : t === 100 ? "Deadly" : "Fusion Scorer",
    (t) => t === 1 ? "Score your first official goal." : t === 5 ? "Score 5 official goals." : t === 10 ? "Score 10 official goals." : t === 25 ? "Score 25 official goals." : t === 50 ? "Score 50 official goals." : t === 100 ? "Score 100 official goals." : "Score 250 official goals."
  ),
  ...createMilestoneObjectives(
    "Seasons", "seasonsPlayed", [1, 3, 5, 7, 10],
    (t) => t === 1 ? "First Season" : t === 3 ? "Seasoned" : t === 10 ? "Mr. Unemployed" : `${t} Seasons`,
    (t) => t === 1 ? "Play your first official season." : t === 3 ? "Play 3 different official seasons." : t === 10 ? "Play 10 different official seasons." : `Play ${t} different official seasons.`
  ),
  ...createMilestoneObjectives(
    "Teams", "teamsPlayed", [1, 3, 5, 7, 10],
    (t) => t === 1 ? "First Team" : `${t} Teams`,
    (t) => t === 1 ? "Play for your first team." : `Play for ${t} different teams.`
  ),
  ...createMilestoneObjectives(
    "Assists", "assists", [1, 5, 10, 25, 50, 100, 250],
    (t) => t === 1 ? "Provider" : t === 5 ? "Creator" : t === 10 ? "Playmaker" : t === 25 ? "Architect" : t === 50 ? "Visionary" : t === 100 ? "Mastermind" : "Fusion Assister",
    (t) => t === 1 ? "Deliver your first official assist." : t === 5 ? "Deliver 5 official assists." : t === 10 ? "Deliver 10 official assists." : t === 25 ? "Deliver 25 official assists." : t === 50 ? "Deliver 50 official assists." : t === 100 ? "Deliver 100 official assists." : "Deliver 250 official assists."
  ),
  ...createMilestoneObjectives(
    "Wins", "matchesWon", [1, 5, 10, 25, 50, 75, 100],
    (t) => t === 1 ? "Winner" : t === 5 ? "Contender" : t === 10 ? "Competitor" : t === 25 ? "Closer" : t === 50 ? "Champion" : t === 75 ? "Dominant" : "Dynasty",
    (t) => t === 1 ? "Get your first official win." : t === 5 ? "Get 5 official wins." : t === 10 ? "Get 10 official wins." : t === 25 ? "Get 25 official wins." : t === 50 ? "Get 50 official wins." : t === 75 ? "Get 75 official wins." : "Get 100 official wins."
  ),
  // ── Awards ──────────────────────────────────────────────────────────────────
  ...createMilestoneObjectives(
    "MVP", "mvp", [1, 5, 10, 15, 20, 25, 30],
    (t) => t === 1 ? "Star" : t === 5 ? "Showman" : t === 10 ? "Franchise" : t === 15 ? "Superstar" : t === 20 ? "Icon" : t === 25 ? "Legend" : "Immortal",
    (t) => t === 1 ? "Earn your first official MVP." : t === 5 ? "Earn 5 official MVPs." : t === 10 ? "Earn 10 official MVPs." : t === 15 ? "Earn 15 official MVPs." : t === 20 ? "Earn 20 official MVPs." : t === 25 ? "Earn 25 official MVPs." : "Earn 30 official MVPs."
  ),
  ...createMilestoneObjectives(
    "TOTW", "totw", [1, 5, 10, 15, 20, 25, 30],
    (t) => t === 1 ? "Call-Up" : t === 5 ? "Recognized" : t === 10 ? "Standout" : t === 15 ? "Elite" : t === 20 ? "Top Class" : t === 25 ? "World Class" : "Hall of Fame",
    (t) => t === 1 ? "Make the Team of the Week." : t === 5 ? "Make the Team of the Week 5 times." : t === 10 ? "Make the Team of the Week 10 times." : t === 15 ? "Make the Team of the Week 15 times." : t === 20 ? "Make the Team of the Week 20 times." : t === 25 ? "Make the Team of the Week 25 times." : "Make the Team of the Week 30 times."
  ),
  // ── Defensive ───────────────────────────────────────────────────────────────
  ...createMilestoneObjectives(
    "CS", "cleanSheets", [1, 5, 10, 25, 50, 75, 100],
    (t) => t === 1 ? "Clean Sheet" : t === 5 ? "Safe Hands" : t === 10 ? "Solid" : t === 25 ? "Reliable" : t === 50 ? "Guardian" : t === 75 ? "Fortress" : "Fusion Keeper",
    (t) => t === 1 ? "Get your first official clean sheet." : t === 5 ? "Get 5 official clean sheets." : t === 10 ? "Get 10 official clean sheets." : t === 25 ? "Get 25 official clean sheets." : t === 50 ? "Get 50 official clean sheets." : t === 75 ? "Get 75 official clean sheets." : "Get 100 official clean sheets."
  ),
  // ── Technical ───────────────────────────────────────────────────────────────
  ...createMilestoneObjectives(
    "Kicks", "kicks", [100, 500, 1000, 2500, 5000, 7500, 10000],
    (t) => t === 100 ? "First Touch" : t === 500 ? "Involved" : t === 1000 ? "Busy Feet" : t === 2500 ? "Ball Magnet" : t === 5000 ? "Ever-Present" : t === 7500 ? "Everywhere" : "Omnipresent",
    (t) => `Accumulate ${t} total kicks.`
  ),
  // ── Sub-branches from Goals ──────────────────────────────────────────────────
  ...createMilestoneObjectives(
    "Braces", "braces", [1, 5, 10, 15, 20, 25, 30],
    (t) => t === 1 ? "First Brace" : `${t} Braces`,
    (t) => t === 1 ? "Score 2 goals in a single match." : `Score 2+ goals in ${t} different matches.`
  ),
  ...createMilestoneObjectives(
    "HatTricks", "hatTricks", [1, 5, 10, 15, 20, 25, 30],
    (t) => t === 1 ? "Hat-Trick" : `${t} Hat-Tricks`,
    (t) => t === 1 ? "Score 3 goals in a single match." : `Score 3+ goals in ${t} different matches.`
  ),
  ...createMilestoneObjectives(
    "Pokers", "pokers", [1, 5, 10, 15, 20, 25, 30],
    (t) => t === 1 ? "Poker" : `${t} Pokers`,
    (t) => t === 1 ? "Score 4 or more goals in a single match." : `Score 4+ goals in ${t} different matches.`
  ),
  // ── Sub-branch from Assists ──────────────────────────────────────────────────
  ...createMilestoneObjectives(
    "PreAssists", "preassists", [1, 5, 10, 25, 50, 100, 250],
    (t) => t === 1 ? "First Pre-Assist" : `${t} Pre-Assists`,
    (t) => t === 1 ? "Deliver your first official pre-assist." : `Deliver ${t} official pre-assists.`
  ),
  {
    key: "one-club-man",
    category: "Badges",
    label: "One Club Man",
    description: "Play 5 different seasons with the same team.",
    target: 5,
    stat: "sameTeamSeasonsMax",
  },
  {
    key: "goal-minutes-0-20",
    category: "Badges",
    label: "Full Timeline",
    description: "Score at least one goal in every minute from 0 to 20.",
    target: 21,
    stat: "goalMinutesCovered",
  },
  {
    key: "nations",
    category: "Badges",
    label: "Nations",
    description: "Participate in at least one Nations Cup.",
    target: 1,
    stat: "nationsParticipations",
  },
  {
    key: "all-stars",
    category: "Badges",
    label: "All Stars",
    description: "Win an All Stars, Future Stars, or Rising Stars.",
    target: 1,
    stat: "allStarTitles",
  },
  {
    key: "rookie-placeholder-3",
    category: "Badges",
    label: "TBD",
    description: "Row III badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-4a",
    category: "Badges",
    label: "TBD",
    description: "Row IV badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-4b",
    category: "Badges",
    label: "TBD",
    description: "Row IV badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-4c",
    category: "Badges",
    label: "TBD",
    description: "Row IV badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-4d",
    category: "Badges",
    label: "TBD",
    description: "Row IV badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-5a",
    category: "Badges",
    label: "TBD",
    description: "Row V badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-5b",
    category: "Badges",
    label: "TBD",
    description: "Row V badge to be defined.",
    target: 1,
    stat: "rookiePlaceholder",
  },
  {
    key: "placeholder-6a",
    category: "Badges",
    label: "TBD",
    description: "Row VI badge to be defined.",
    target: 1,
    stat: "championPlaceholder",
  },
  {
    key: "placeholder-7a",
    category: "Badges",
    label: "TBD",
    description: "Row VII badge to be defined.",
    target: 1,
    stat: "fusionPlaceholder",
  },
  {
    key: "versatile",
    category: "Badges",
    label: "Versatile",
    description: "Play at least one match in GK, CB, CM, LW or RW, and ST.",
    target: 5,
    stat: "versatileCoverage",
  },
  {
    key: "double-double",
    category: "Badges",
    label: "Double Double",
    description: "Reach 10+ goals and 10+ assists in the same season.",
    target: 1,
    stat: "doubleDoubleSeasons",
  },
  {
    key: "invincible",
    category: "Badges",
    label: "Invincible",
    description: "Finish a season unbeaten with more than 5 matches played.",
    target: 1,
    stat: "seasonInvictos",
  },
  {
    key: "captain",
    category: "Badges",
    label: "Captain",
    description: "Serve as captain or vice-captain for any team.",
    target: 1,
    stat: "captaincies",
  },
  {
    key: "impact-sub",
    category: "Badges",
    label: "Impact Sub",
    description: "Score or assist after coming on as a substitute.",
    target: 1,
    stat: "impactSubMatches",
  },
  {
    key: "new-colours",
    category: "Badges",
    label: "New Colours",
    description: "Play for 2 different teams with 4+ matches each.",
    target: 2,
    stat: "teamsOverFourMatches",
  },
  {
    key: "full-shift",
    category: "Badges",
    label: "Full Shift",
    description: "Play a full match without being substituted.",
    target: 1,
    stat: "fullShiftMatches",
  },
  {
    key: "ups",
    category: "Badges",
    label: "Ups",
    description: "Score 1 own goal.",
    target: 1,
    stat: "ownGoals",
  },
  {
    key: "double-threat",
    category: "Badges",
    label: "Double Threat",
    description: "Score and assist in the same match.",
    target: 1,
    stat: "doubleThreatMatches",
  },
  {
    key: "no-mercy",
    category: "Badges",
    label: "No Mercy",
    description: "Win by mercy with a 7+ goal difference.",
    target: 1,
    stat: "mercyWins",
  },
  {
    key: "comeback",
    category: "Badges",
    label: "Comeback",
    description: "Come back to win a match.",
    target: 1,
    stat: "comebackWins",
  },
  {
    key: "league-winner",
    category: "Badges",
    label: "League Winner",
    description: "Win a league with your team.",
    target: 1,
    stat: "leagueTitles",
  },
  {
    key: "summer-winner",
    category: "Badges",
    label: "Summer Winner",
    description: "Win a Summer Cup with your team.",
    target: 1,
    stat: "summerTitles",
  },
  {
    key: "globetrotter",
    category: "Badges",
    label: "Globetrotter",
    description: "Play for 10 different teams with 4+ matches each.",
    target: 10,
    stat: "teamsOverFourMatches",
  },
  {
    key: "opening-strike",
    category: "Badges",
    label: "Opening Strike",
    description: "Score a goal at minute 0.",
    target: 1,
    stat: "openingStrikeGoals",
  },
  {
    key: "silent-genius",
    category: "Badges",
    label: "Silent Genius",
    description: "Make 3 pre-assists in a single match.",
    target: 1,
    stat: "silentGeniusMatches",
  },
  {
    key: "late-hero",
    category: "Badges",
    label: "Late Hero",
    description: "Score the winning goal in minute 19 or 20.",
    target: 1,
    stat: "lateHeroWins",
  },
  {
    key: "cup-winner",
    category: "Badges",
    label: "Cup Winner",
    description: "Win a cup with your team.",
    target: 1,
    stat: "cupTitles",
  },
  {
    key: "supercup-winner",
    category: "Badges",
    label: "Supercup Winner",
    description: "Win a supercup with your team.",
    target: 1,
    stat: "supercupTitles",
  },
  {
    key: "perfect-start",
    category: "Badges",
    label: "Perfect Start",
    description: "Score in your first 3 matches of a season.",
    target: 1,
    stat: "perfectStartSeasons",
  },
  {
    key: "treble",
    category: "Badges",
    label: "Treble",
    description: "Win league, cup, and supercup in the same season.",
    target: 1,
    stat: "trebleSeasons",
  },
  {
    key: "nations-winner",
    category: "Badges",
    label: "Nations",
    description: "Win a Nations Cup with your team.",
    target: 1,
    stat: "nationsTitles",
  },
  {
    key: "big-night",
    category: "Badges",
    label: "Big Night",
    description: "Score 3+ goals and deliver 3+ assists in the same match.",
    target: 1,
    stat: "bigNightMatches",
  },
  {
    key: "league-dynasty",
    category: "Badges",
    label: "League Dynasty",
    description: "Win 5 leagues with your team.",
    target: 5,
    stat: "leagueTitles",
  },
  {
    key: "best-award",
    category: "Badges",
    label: "Best Winner",
    description: "Win a Best GK, Best Defender, Best Midfielder, Best Attacker, or Best MVP award.",
    target: 1,
    stat: "bestAwards",
  },
  {
    key: "double-century",
    category: "Badges",
    label: "Dual Centurion",
    description: "Reach 100+ goals and 100+ assists in your career.",
    target: 1,
    stat: "doubleCenturyCareer",
  },
]

function normalizeRoles(roles?: Array<UserRole | string>) {
  return (roles ?? [])
    .map((role) => {
      if (typeof role === "string") return { id: role, name: role }
      if (role?.id && role?.name) return role
      return null
    })
    .filter((role): role is UserRole => Boolean(role))
}

function mergeRoles(base: UserRole[], extra: UserRole[]) {
  const merged = new Map<string, UserRole>()
  for (const role of base) merged.set(role.id, role)
  for (const role of extra) merged.set(role.id, role)
  return [...merged.values()]
}

async function getManualRolesForPlayer(db: Db, playerObjectId: string) {
  const manualRoleDoc = await db.collection("playermanualroles").findOne<{
    playerId: ObjectId
    roles?: Array<UserRole | string>
  }>({ playerId: new ObjectId(playerObjectId) }, { projection: { roles: 1 } })
  return normalizeRoles(manualRoleDoc?.roles)
}

const ZERO_STATS: ProfileStats = {
  matchesPlayed: 0, matchesWon: 0, goals: 0, assists: 0, preassists: 0,
  cleanSheets: 0, mvp: 0, totw: 0, kicks: 0, braces: 0, hatTricks: 0, pokers: 0,
  seasonsPlayed: 0, sameTeamSeasonsMax: 0, goalMinutesCovered: 0, nationsParticipations: 0,
  teamsPlayed: 0, versatileCoverage: 0, doubleDoubleSeasons: 0, invincibleLeagues: 0, captaincies: 0,
  impactSubMatches: 0, teamsOverFourMatches: 0, fullShiftMatches: 0, ownGoals: 0, doubleThreatMatches: 0,
  allStarTitles: 0, mercyWins: 0, comebackWins: 0, leagueTitles: 0, summerTitles: 0, rookiePlaceholder: 0, openingStrikeGoals: 0,
  cupTitles: 0, supercupTitles: 0, silentGeniusMatches: 0, lateHeroWins: 0, perfectStartSeasons: 0,
  trebleSeasons: 0, nationsTitles: 0, bigNightMatches: 0, seasonInvictos: 0, bestAwards: 0, doubleCenturyCareer: 0, championPlaceholder: 0, fusionPlaceholder: 0,
}

type UserRow = {
  discordId: string
  playerId?: ObjectId | null
  roles?: Array<UserRole | string>
  discordAvatar?: string | null
  discordName?: string | null
}

type PlayerRow = {
  _id: ObjectId
  player_id: number
  player_name: string
  country: string
  avatar?: string
}

type CareerStatsRow = {
  matchesPlayed?: number
  matchesWon?: number
  goals?: number
  assists?: number
  preassists?: number
  cleanSheets?: number
  mvp?: number
  totw?: number
  kicks?: number
  ownGoals?: number
}

type MultiGoalRow = {
  braces?: number
  hatTricks?: number
  pokers?: number
}

type SeasonInvictosRow = {
  seasonInvictos?: number
}

type SeasonsRow = {
  seasonsPlayed?: number
  sameTeamSeasonsMax?: number
}

type GoalMinutesRow = {
  goalMinutesCovered?: number
  openingStrikeGoals?: number
}

type NationsRow = {
  nationsParticipations?: number
}

type VersatileRow = {
  versatileCoverage?: number
}

type DoubleDoubleRow = {
  doubleDoubleSeasons?: number
}

type InvincibleRow = {
  invincibleLeagues?: number
}

type TeamsRow = {
  teamsPlayed?: number
  teamsOverFourMatches?: number
}

type CaptainRow = {
  captaincies?: number
}

type RookieBadgesRow = {
  impactSubMatches?: number
  fullShiftMatches?: number
  doubleThreatMatches?: number
  bigNightMatches?: number
  silentGeniusMatches?: number
}

type MatchBadgeRow = {
  playerCompetitionId: unknown
  teamCompetitionId: unknown
  matchId: unknown
  team1CompetitionId: unknown
  team2CompetitionId: unknown
  scoreTeam1?: unknown
  scoreTeam2?: unknown
  goalsDetails?: Array<{ minute?: unknown; team?: unknown; scorer?: unknown }>
}

type TitleRow = {
  _id?: string
  competitions?: unknown[]
}

type TitleSeasonRow = {
  titles?: unknown[]
}

type SeasonMatchRow = {
  seasonKey?: string
  matchId?: unknown
  matchDate?: unknown
  goals?: number
  preassists?: number
}

// --- Profile cache (5 min TTL) ---
const profileCache = new Map<string, { data: UserProfileData; expiry: number }>()
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000

function getCachedProfile(key: string): UserProfileData | null {
  const entry = profileCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) { profileCache.delete(key); return null }
  return entry.data
}

function setCachedProfile(key: string, data: UserProfileData) {
  if (profileCache.size > 200) profileCache.clear()
  profileCache.set(key, { data, expiry: Date.now() + PROFILE_CACHE_TTL_MS })
}

export function invalidateProfileCache(discordId?: string, playerObjectId?: string) {
  if (discordId && playerObjectId) {
    profileCache.delete(`${discordId}:${playerObjectId}`)
  } else {
    profileCache.clear()
  }
}


async function buildProfileStats(db: Db, playerOid: ObjectId, playerObjectId: string, normalizedUserRoles: UserRole[]) {
  // Pre-fetch player_competition_ids (1 cheap indexed query replaces 6 full collection scans)
  const pcIdDocs = await db.collection("playercompetitions")
    .find({ player_id: playerOid }, { projection: { _id: 1 } })
    .toArray()
  const pcIds = pcIdDocs.map((d) => d._id)

  // Run all aggregations + manual roles in parallel (consolidated via $facet)
  const [manualRolesResult, player, goalMinutesRow, pcFacetResult, pmsFacetResult] = await Promise.all([
    getManualRolesForPlayer(db, playerObjectId),
    db.collection("players").findOne<PlayerRow>(
      { _id: playerOid },
      { projection: { _id: 1, player_id: 1, player_name: 1, country: 1, avatar: 1 } }
    ),

    // Goal minutes (different collection — stays standalone)
    db.collection("goals").aggregate<GoalMinutesRow>([
      { $match: { scorer_id: { $in: pcIds }, minute: { $gte: 0, $lte: 20 } } },
      {
        $group: {
          _id: null,
          coveredMinutes: { $addToSet: "$minute" },
        },
      },
      {
        $project: {
          goalMinutesCovered: { $size: "$coveredMinutes" },
          openingStrikeGoals: {
            $size: {
              $filter: {
                input: "$coveredMinutes",
                as: "minute",
                cond: { $eq: ["$$minute", 0] },
              },
            },
          },
        },
      },
    ]).next(),

    // playercompetitions $facet (10 pipelines → 1 round-trip)
    db.collection("playercompetitions").aggregate<{
      careerTotals: CareerStatsRow[];
      captaincy: CaptainRow[];
      teams: TeamsRow[];
      seasonInvictos: SeasonInvictosRow[];
      seasons: SeasonsRow[];
      nations: NationsRow[];
      doubleDouble: DoubleDoubleRow[];
      invincible: InvincibleRow[];
      titles: TitleRow[];
      titleSeasons: TitleSeasonRow[];
    }>([
      { $match: { player_id: playerOid } },
      {
        $facet: {
          careerTotals: [
            {
              $group: {
                _id: "$player_id",
                matchesPlayed: { $sum: { $ifNull: ["$matchesPlayed", { $ifNull: ["$matches_played", 0] }] } },
                matchesWon:    { $sum: { $ifNull: ["$matchesWon",    { $ifNull: ["$matches_won", 0] }] } },
                goals:         { $sum: { $ifNull: ["$goals",         0] } },
                assists:       { $sum: { $ifNull: ["$assists",       0] } },
                preassists:    { $sum: { $ifNull: ["$preassists",    0] } },
                cleanSheets:   { $sum: { $ifNull: ["$cs",            0] } },
                mvp:           { $sum: { $ifNull: ["$MVP",           0] } },
                totw:          { $sum: { $ifNull: ["$TOTW",          0] } },
                kicks:         { $sum: { $ifNull: ["$kicks",         0] } },
                ownGoals:      { $sum: { $ifNull: ["$owngoals",      0] } },
              },
            },
          ],
          captaincy: [
            {
              $project: {
                leadership: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$is_captain", true] },
                        { $eq: ["$is_subcaptain", true] },
                        { $eq: ["$isCaptain", true] },
                        { $eq: ["$isSubcaptain", true] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                captaincies: { $max: "$leadership" },
              },
            },
          ],
          teams: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $group: {
                _id: "$teamCompetition.team_id",
                matchesPlayed: {
                  $sum: { $ifNull: ["$matchesPlayed", { $ifNull: ["$matches_played", 0] }] },
                },
              },
            },
            {
              $group: {
                _id: null,
                teamsPlayed: { $sum: 1 },
                teamsOverFourMatches: {
                  $sum: {
                    $cond: [{ $gt: ["$matchesPlayed", 4] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                teamsPlayed: 1,
                teamsOverFourMatches: 1,
              },
            },
          ],
          seasonInvictos: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            { $match: { "competition.type": "league" } },
            {
              $project: {
                seasonKey: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$competition.start_date",
                  },
                },
                matchesLost: { $ifNull: ["$matchesLost", { $ifNull: ["$matches_lost", 0] }] },
                matchesPlayed: { $ifNull: ["$matchesPlayed", { $ifNull: ["$matches_played", 0] }] },
              },
            },
            {
              $group: {
                _id: "$seasonKey",
                matchesLost: { $sum: "$matchesLost" },
                matchesPlayed: { $sum: "$matchesPlayed" },
              },
            },
            {
              $group: {
                _id: null,
                seasonInvictos: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gt: ["$matchesPlayed", 5] }, { $eq: ["$matchesLost", 0] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          seasons: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            {
              $project: {
                teamId: "$teamCompetition.team_id",
                competitionType: "$competition.type",
                seasonKey: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$competition.start_date",
                  },
                },
              },
            },
            { $match: { seasonKey: { $nin: [null, ""] }, competitionType: "league" } },
            {
              $group: {
                _id: null,
                seasons: { $addToSet: "$seasonKey" },
                teamSeasonPairs: { $addToSet: { teamId: "$teamId", seasonKey: "$seasonKey" } },
              },
            },
            {
              $project: {
                seasonsPlayed: { $size: "$seasons" },
                sameTeamSeasonsMax: {
                  $let: {
                    vars: {
                      perTeam: {
                        $map: {
                          input: {
                            $setUnion: [
                              [],
                              { $map: { input: "$teamSeasonPairs", as: "pair", in: "$$pair.teamId" } },
                            ],
                          },
                          as: "teamId",
                          in: {
                            $size: {
                              $filter: {
                                input: "$teamSeasonPairs",
                                as: "pair",
                                cond: { $eq: ["$$pair.teamId", "$$teamId"] },
                              },
                            },
                          },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $gt: [{ $size: "$$perTeam" }, 0] },
                        { $max: "$$perTeam" },
                        0,
                      ],
                    },
                  },
                },
              },
            },
          ],
          nations: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            { $match: { "competition.type": "nations_cup" } },
            {
              $group: {
                _id: null,
                competitions: { $addToSet: "$teamCompetition.competition_id" },
              },
            },
            {
              $project: {
                nationsParticipations: { $size: "$competitions" },
              },
            },
          ],
          doubleDouble: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            { $match: { "competition.type": "league" } },
            {
              $project: {
                seasonKey: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$competition.start_date",
                  },
                },
                competitionId: "$teamCompetition.competition_id",
                goals: { $ifNull: ["$goals", 0] },
                assists: { $ifNull: ["$assists", 0] },
                matchesLost: { $ifNull: ["$matchesLost", { $ifNull: ["$matches_lost", 0] }] },
                matchesPlayed: { $ifNull: ["$matchesPlayed", { $ifNull: ["$matches_played", 0] }] },
              },
            },
            {
              $group: {
                _id: "$seasonKey",
                goals: { $sum: "$goals" },
                assists: { $sum: "$assists" },
              },
            },
            {
              $group: {
                _id: null,
                doubleDoubleSeasons: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gte: ["$goals", 10] }, { $gte: ["$assists", 10] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          invincible: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            { $match: { "competition.type": "league" } },
            {
              $project: {
                competitionId: "$teamCompetition.competition_id",
                matchesLost: { $ifNull: ["$matchesLost", { $ifNull: ["$matches_lost", 0] }] },
                matchesPlayed: { $ifNull: ["$matchesPlayed", { $ifNull: ["$matches_played", 0] }] },
              },
            },
            {
              $group: {
                _id: "$competitionId",
                matchesLost: { $sum: "$matchesLost" },
                matchesPlayed: { $sum: "$matchesPlayed" },
              },
            },
            {
              $group: {
                _id: null,
                invincibleLeagues: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gt: ["$matchesPlayed", 4] }, { $eq: ["$matchesLost", 0] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          titles: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            {
              $match: {
                $expr: { $eq: ["$teamCompetition.team_id", "$competition.champion_team_id"] },
                "competition.type": { $in: ["league", "summer_cup", "cup", "supercup", "nations_cup"] },
              },
            },
            {
              $group: {
                _id: "$competition.type",
                competitions: { $addToSet: "$competition._id" },
              },
            },
          ],
          titleSeasons: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            {
              $match: {
                $expr: { $eq: ["$teamCompetition.team_id", "$competition.champion_team_id"] },
                "competition.type": { $in: ["league", "cup", "supercup", "nations_cup"] },
              },
            },
            {
              $project: {
                type: "$competition.type",
                seasonKey: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$competition.start_date",
                  },
                },
              },
            },
            {
              $group: {
                _id: "$seasonKey",
                titles: { $addToSet: "$type" },
              },
            },
          ],
        },
      },
    ]).next(),

    // playermatchstats $facet (5 pipelines → 1 round-trip)
    db.collection("playermatchstats").aggregate<{
      multiGoal: MultiGoalRow[];
      versatile: VersatileRow[];
      rookieBadges: RookieBadgesRow[];
      matchBadges: MatchBadgeRow[];
      seasonMatch: SeasonMatchRow[];
    }>([
      { $match: { player_competition_id: { $in: pcIds } } },
      {
        $facet: {
          multiGoal: [
            {
              $group: {
                _id: null,
                braces:    { $sum: { $cond: [{ $gte: ["$goals", 2] }, 1, 0] } },
                hatTricks: { $sum: { $cond: [{ $gte: ["$goals", 3] }, 1, 0] } },
                pokers:    { $sum: { $cond: [{ $gte: ["$goals", 4] }, 1, 0] } },
              },
            },
          ],
          versatile: [
            {
              $project: {
                position: "$position",
                group: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$position", "GK"] }, then: "gk" },
                      { case: { $eq: ["$position", "CB"] }, then: "cb" },
                      { case: { $eq: ["$position", "CM"] }, then: "cm" },
                      { case: { $in: ["$position", ["LW", "RW"]] }, then: "wing" },
                      { case: { $eq: ["$position", "ST"] }, then: "st" },
                    ],
                    default: null,
                  },
                },
              },
            },
            { $match: { group: { $ne: null } } },
            {
              $group: {
                _id: null,
                groups: { $addToSet: "$group" },
              },
            },
            {
              $project: {
                versatileCoverage: { $size: "$groups" },
              },
            },
          ],
          rookieBadges: [
            {
              $lookup: {
                from: "playermatchstats",
                localField: "match_id",
                foreignField: "match_id",
                as: "sameMatchStats",
              },
            },
            {
              $project: {
                substitute: { $ifNull: ["$substitute", 0] },
                starter: { $ifNull: ["$starter", 0] },
                goals: { $ifNull: ["$goals", 0] },
                assists: { $ifNull: ["$assists", 0] },
                minutesPlayed: { $ifNull: ["$minutes_played", { $ifNull: ["$minutesPlayed", 0] }] },
                matchMaxMinutes: {
                  $max: {
                    $map: {
                      input: "$sameMatchStats",
                      as: "row",
                      in: { $ifNull: ["$$row.minutes_played", { $ifNull: ["$$row.minutesPlayed", 0] }] },
                    },
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                impactSubMatches: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ["$substitute", 0] },
                          { $or: [{ $gt: ["$goals", 0] }, { $gt: ["$assists", 0] }] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                fullShiftMatches: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ["$starter", 0] },
                          { $eq: ["$substitute", 0] },
                          { $gte: ["$minutesPlayed", { $subtract: ["$matchMaxMinutes", 20] }] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                doubleThreatMatches: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gt: ["$goals", 0] }, { $gt: ["$assists", 0] }] },
                      1,
                      0,
                    ],
                  },
                },
                bigNightMatches: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gte: ["$goals", 3] }, { $gte: ["$assists", 3] }] },
                      1,
                      0,
                    ],
                  },
                },
                silentGeniusMatches: {
                  $sum: {
                    $cond: [
                      { $gte: [{ $ifNull: ["$preassists", 0] }, 3] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          matchBadges: [
            {
              $lookup: {
                from: "matches",
                localField: "match_id",
                foreignField: "_id",
                as: "match",
              },
            },
            { $unwind: "$match" },
            {
              $project: {
                playerCompetitionId: "$player_competition_id",
                teamCompetitionId: "$team_competition_id",
                matchId: "$match._id",
                team1CompetitionId: "$match.team1_competition_id",
                team2CompetitionId: "$match.team2_competition_id",
                scoreTeam1: { $ifNull: ["$match.score_team1", 0] },
                scoreTeam2: { $ifNull: ["$match.score_team2", 0] },
                goalsDetails: { $ifNull: ["$match.goalsDetails", []] },
              },
            },
            {
              $group: {
                _id: "$matchId",
                row: { $first: "$$ROOT" },
              },
            },
            { $replaceRoot: { newRoot: "$row" } },
          ],
          seasonMatch: [
            {
              $lookup: {
                from: "teamcompetitions",
                localField: "team_competition_id",
                foreignField: "_id",
                as: "teamCompetition",
              },
            },
            { $unwind: "$teamCompetition" },
            {
              $lookup: {
                from: "competitions",
                localField: "teamCompetition.competition_id",
                foreignField: "_id",
                as: "competition",
              },
            },
            { $unwind: "$competition" },
            {
              $lookup: {
                from: "matches",
                localField: "match_id",
                foreignField: "_id",
                as: "match",
              },
            },
            { $unwind: "$match" },
            {
              $project: {
                seasonKey: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$competition.start_date",
                  },
                },
                matchId: "$match._id",
                matchDate: "$match.date",
                goals: { $ifNull: ["$goals", 0] },
                preassists: { $ifNull: ["$preassists", 0] },
              },
            },
            {
              $sort: {
                seasonKey: 1,
                matchDate: 1,
                matchId: 1,
              },
            },
          ],
        },
      },
    ]).next(),
  ])

  // Extract individual results from $facet responses
  const statsRow = pcFacetResult?.careerTotals?.[0] ?? null
  const captainRow = pcFacetResult?.captaincy?.[0] ?? null
  const teamsRow = pcFacetResult?.teams?.[0] ?? null
  const seasonInvictosRow = pcFacetResult?.seasonInvictos?.[0] ?? null
  const seasonsRow = pcFacetResult?.seasons?.[0] ?? null
  const nationsRow = pcFacetResult?.nations?.[0] ?? null
  const doubleDoubleRow = pcFacetResult?.doubleDouble?.[0] ?? null
  const invincibleRow = pcFacetResult?.invincible?.[0] ?? null
  const titleRows = pcFacetResult?.titles ?? []
  const titleSeasonRows = pcFacetResult?.titleSeasons ?? []

  const multiGoalRow = pmsFacetResult?.multiGoal?.[0] ?? null
  const versatileRow = pmsFacetResult?.versatile?.[0] ?? null
  const rookieBadgesRow = pmsFacetResult?.rookieBadges?.[0] ?? null
  const matchBadgeRows = pmsFacetResult?.matchBadges ?? []
  const seasonMatchRows = pmsFacetResult?.seasonMatch ?? []


  const effectiveUserRoles = mergeRoles(normalizedUserRoles, manualRolesResult)

  const allStarTitles = effectiveUserRoles.filter((role) => {
    const normalized = role.name.normalize("NFKC").toLowerCase()
    return normalized.includes("all stars") || normalized.includes("future stars") || normalized.includes("rising stars")
  }).length

  const matchBadgeTotals = (matchBadgeRows ?? []).reduce(
    (acc, row) => {
      const isTeam1 = String(row.teamCompetitionId) === String(row.team1CompetitionId)
      const isTeam2 = String(row.teamCompetitionId) === String(row.team2CompetitionId)
      if (!isTeam1 && !isTeam2) return acc

      const teamScore = isTeam1 ? Number(row.scoreTeam1 ?? 0) : Number(row.scoreTeam2 ?? 0)
      const opponentScore = isTeam1 ? Number(row.scoreTeam2 ?? 0) : Number(row.scoreTeam1 ?? 0)

      if (teamScore > opponentScore && teamScore - opponentScore >= 7) {
        acc.mercyWins += 1
      }

      let ownRunning = 0
      let opponentRunning = 0
      let wasTrailing = false

      const goalsDetails = Array.isArray(row.goalsDetails) ? [...row.goalsDetails] : []
      goalsDetails
        .sort((a, b) => Number(a?.minute ?? 0) - Number(b?.minute ?? 0))
        .forEach((goal) => {
          const byOwnTeam = String(goal?.team) === String(row.teamCompetitionId)
          if (byOwnTeam) ownRunning += 1
          else opponentRunning += 1
          if (ownRunning < opponentRunning) wasTrailing = true
        })

      if (wasTrailing && teamScore > opponentScore) {
        acc.comebackWins += 1
      }

      if (teamScore > opponentScore) {
        const goalsDetails = Array.isArray(row.goalsDetails) ? [...row.goalsDetails] : []
        const ownGoals = goalsDetails
          .filter((goal) => String(goal?.team) === String(row.teamCompetitionId))
          .sort((a, b) => Number(a?.minute ?? 0) - Number(b?.minute ?? 0))

        const winningGoal = ownGoals[opponentScore]
        if (
          winningGoal &&
          String(winningGoal?.scorer) === String(row.playerCompetitionId) &&
          [19, 20].includes(Number(winningGoal?.minute ?? -1))
        ) {
          acc.lateHeroWins += 1
        }
      }

      return acc
    },
    { mercyWins: 0, comebackWins: 0, lateHeroWins: 0 }
  )

  const titleTotals = (titleRows ?? []).reduce(
    (acc, row) => {
      const count = Array.isArray(row?.competitions) ? row.competitions.length : 0
      if (row?._id === "league") acc.leagueTitles = count
      if (row?._id === "summer_cup") acc.summerTitles = count
      if (row?._id === "cup") acc.cupTitles = count
      if (row?._id === "supercup") acc.supercupTitles = count
      if (row?._id === "nations_cup") acc.nationsTitles = count
      return acc
    },
    { leagueTitles: 0, summerTitles: 0, cupTitles: 0, supercupTitles: 0, nationsTitles: 0 }
  )

  const trebleSeasons = (titleSeasonRows ?? []).reduce((sum, row) => {
    const titles = new Set(Array.isArray(row?.titles) ? row.titles.map((item) => String(item)) : [])
    return titles.has("league") && titles.has("cup") && titles.has("supercup") ? sum + 1 : sum
  }, 0)

  const seasonMatchMap = new Map<string, Array<{ goals: number }>>()
  for (const row of seasonMatchRows ?? []) {
    const seasonKey = row?.seasonKey ? String(row.seasonKey) : ""
    const matchId = row?.matchId ? String(row.matchId) : ""
    if (!seasonKey || !matchId) continue
    const key = `${seasonKey}:${matchId}`
    if (!seasonMatchMap.has(key)) {
      seasonMatchMap.set(key, [])
    }
    seasonMatchMap.get(key)?.push({ goals: Number(row?.goals ?? 0) })
  }

  const seasonBuckets = new Map<string, number[]>()
  for (const [compositeKey, rows] of seasonMatchMap.entries()) {
    const seasonKey = compositeKey.split(":")[0]
    const totalGoals = rows.reduce((sum, row) => sum + row.goals, 0)
    const bucket = seasonBuckets.get(seasonKey) ?? []
    bucket.push(totalGoals)
    seasonBuckets.set(seasonKey, bucket)
  }

  const perfectStartSeasons = [...seasonBuckets.values()].reduce((sum, goalsByMatch) => {
    if (goalsByMatch.length < 3) return sum
    return goalsByMatch.slice(0, 3).every((goals) => goals > 0) ? sum + 1 : sum
  }, 0)

  const bestAwards = effectiveUserRoles.filter((role) => {
    const normalized = role.name.normalize("NFKC").toLowerCase()
    return normalized.includes("best gk") || normalized.includes("best defender") || normalized.includes("best midfielder") || normalized.includes("best attacker") || normalized.includes("best mvp")
  }).length

  const doubleCenturyCareer = Number((Number(statsRow?.goals ?? 0) > 100 && Number(statsRow?.assists ?? 0) > 100) ? 1 : 0)

  const stats: ProfileStats = {
    matchesPlayed: Number(statsRow?.matchesPlayed ?? 0),
    matchesWon:    Number(statsRow?.matchesWon    ?? 0),
    goals:         Number(statsRow?.goals         ?? 0),
    assists:       Number(statsRow?.assists       ?? 0),
    preassists:    Number(statsRow?.preassists    ?? 0),
    cleanSheets:   Number(statsRow?.cleanSheets   ?? 0),
    mvp:           Number(statsRow?.mvp           ?? 0),
    totw:          Number(statsRow?.totw          ?? 0),
    kicks:         Number(statsRow?.kicks         ?? 0),
    braces:        Number(multiGoalRow?.braces    ?? 0),
    hatTricks:     Number(multiGoalRow?.hatTricks ?? 0),
    pokers:        Number(multiGoalRow?.pokers    ?? 0),
    seasonsPlayed: Number(seasonsRow?.seasonsPlayed ?? 0),
    sameTeamSeasonsMax: Number(seasonsRow?.sameTeamSeasonsMax ?? 0),
    goalMinutesCovered: Number(goalMinutesRow?.goalMinutesCovered ?? 0),
    nationsParticipations: Number(nationsRow?.nationsParticipations ?? 0),
    teamsPlayed: Number(teamsRow?.teamsPlayed ?? 0),
    versatileCoverage: Number(versatileRow?.versatileCoverage ?? 0),
    doubleDoubleSeasons: Number(doubleDoubleRow?.doubleDoubleSeasons ?? 0),
    invincibleLeagues: Number(invincibleRow?.invincibleLeagues ?? 0),
    seasonInvictos: Number(seasonInvictosRow?.seasonInvictos ?? 0),
    captaincies: Number(captainRow?.captaincies ?? 0),
    impactSubMatches: Number(rookieBadgesRow?.impactSubMatches ?? 0),
    teamsOverFourMatches: Number(teamsRow?.teamsOverFourMatches ?? 0),
    fullShiftMatches: Number(rookieBadgesRow?.fullShiftMatches ?? 0),
    ownGoals: Number(statsRow?.ownGoals ?? 0),
    doubleThreatMatches: Number(rookieBadgesRow?.doubleThreatMatches ?? 0),
    allStarTitles,
    mercyWins: matchBadgeTotals.mercyWins,
    comebackWins: matchBadgeTotals.comebackWins,
    leagueTitles: titleTotals.leagueTitles,
    summerTitles: titleTotals.summerTitles,
    rookiePlaceholder: 0,
    openingStrikeGoals: Number(goalMinutesRow?.openingStrikeGoals ?? 0),
    cupTitles: titleTotals.cupTitles,
    supercupTitles: titleTotals.supercupTitles,
    silentGeniusMatches: Number(rookieBadgesRow?.silentGeniusMatches ?? 0),
    lateHeroWins: matchBadgeTotals.lateHeroWins,
    perfectStartSeasons,
    trebleSeasons,
    nationsTitles: titleTotals.nationsTitles,
    bigNightMatches: Number(rookieBadgesRow?.bigNightMatches ?? 0),
    bestAwards,
    doubleCenturyCareer,
    championPlaceholder: 0,
    fusionPlaceholder: 0,
  }

  return { stats, player, manualRolesResult, effectiveUserRoles }
}

export async function getUserProfileData(db: Db, discordId: string): Promise<UserProfileData | null> {
  const user = await db.collection("users").findOne<UserRow>(
    { discordId },
    { projection: { discordId: 1, playerId: 1, roles: 1, discordAvatar: 1, discordName: 1 } }
  )

  if (!user) return null

  const normalizedUserRoles = normalizeRoles(user.roles)
  const playerObjectId = user.playerId?.toString() || null

  if (!playerObjectId) {
    const noPlayerResult = {
      user: {
        discordId: user.discordId,
        roles: normalizedUserRoles,
        playerId: null,
        discordAvatar: user.discordAvatar ?? null,
        discordName: user.discordName ?? null,
      },
      player: null,
      stats: ZERO_STATS,
      objectives: objectiveDefinitions.map((o) => ({ ...o, current: 0, completed: false })),
    }
    return noPlayerResult
  }

  const cacheKey = `${discordId}:${playerObjectId}`
  const cached = getCachedProfile(cacheKey)
  if (cached) return cached

  const playerOid = new ObjectId(playerObjectId)
  const { stats, player, effectiveUserRoles } = await buildProfileStats(db, playerOid, playerObjectId, normalizedUserRoles)

  const result: UserProfileData = {
    user: {
      discordId: user.discordId,
      roles: effectiveUserRoles,
      playerId: playerObjectId,
      discordAvatar: user.discordAvatar ?? null,
      discordName: user.discordName ?? null,
    },
    player: player
      ? { id: player._id.toString(), playerId: player.player_id, name: player.player_name, country: player.country, avatar: player.avatar }
      : null,
    stats,
    objectives: objectiveDefinitions.map((o) => {
      const current = stats[o.stat]
      const completed = current >= o.target

      if (o.key === "pokers-1") {
        return {
          ...o,
          label: "Poker Face",
          description: "Score a poker with 4+ goals in a single match.",
          current,
          completed,
        }
      }

      if (o.key === "comeback") {
        return {
          ...o,
          description: "Come back to win a match.",
          current,
          completed,
        }
      }

      return {
        ...o,
        current,
        completed,
      }
    }),
  }

  setCachedProfile(cacheKey, result)
  return result
}

export async function getUserProfileDataByObjectId(db: Db, playerObjectId: string): Promise<UserProfileData | null> {
  if (!ObjectId.isValid(playerObjectId)) return null
  const playerOid = new ObjectId(playerObjectId)

  const cacheKey = `anon:${playerObjectId}`
  const cached = getCachedProfile(cacheKey)
  if (cached) return cached

  const { stats, player, effectiveUserRoles } = await buildProfileStats(db, playerOid, playerObjectId, [])

  const result: UserProfileData = {
    user: {
      discordId: "",
      roles: effectiveUserRoles,
      playerId: playerObjectId,
      discordAvatar: null,
      discordName: null,
    },
    player: player
      ? { id: player._id.toString(), playerId: player.player_id, name: player.player_name, country: player.country, avatar: player.avatar }
      : null,
    stats,
    objectives: objectiveDefinitions.map((o) => {
      const current = stats[o.stat]
      const completed = current >= o.target

      if (o.key === "pokers-1") {
        return {
          ...o,
          label: "Poker Face",
          description: "Score a poker with 4+ goals in a single match.",
          current,
          completed,
        }
      }

      if (o.key === "comeback") {
        return {
          ...o,
          description: "Come back to win a match.",
          current,
          completed,
        }
      }

      return {
        ...o,
        current,
        completed,
      }
    }),
  }

  setCachedProfile(cacheKey, result)
  return result
}

export async function getUserProfileDataByPlayerId(db: Db, playerId: string): Promise<UserProfileData | null> {
  let playerObjectId: ObjectId | null = null
  if (ObjectId.isValid(playerId)) {
    playerObjectId = new ObjectId(playerId)
  } else if (Number.isFinite(Number(playerId))) {
    const player = await db.collection("players").findOne({ player_id: Number(playerId) }, { projection: { _id: 1 } })
    playerObjectId = player?._id ?? null
  }

  if (!playerObjectId) return null

  const user = await db.collection("users").findOne<{ discordId: string }>(
    { playerId: playerObjectId },
    { projection: { discordId: 1 } }
  )

  if (!user?.discordId) {
    return getUserProfileDataByObjectId(db, playerObjectId.toString())
  }

  const cacheKey = `${user.discordId}:${playerObjectId.toString()}`
  const cached = getCachedProfile(cacheKey)
  if (cached) return cached

  return getUserProfileData(db, user.discordId)
}

export const PROFILE_ROLE_MANAGER_ID = "1118447762237829190"

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function getManagerRoles(db: Db, discordId: string) {
  const managerUser = await db.collection("users").findOne({ discordId }, { projection: { roles: 1 } }) as { roles?: UserRole[] } | null
  const managerRoles = normalizeRoles(managerUser?.roles)
  const canManage = managerRoles.some((role) => role.id === PROFILE_ROLE_MANAGER_ID)
  return { managerRoles, canManage }
}

export async function fetchGuildRoles(env: { DISCORD_GUILD_ID: string; DISCORD_BOT_TOKEN: string }): Promise<UserRole[]> {
  const { DISCORD_GUILD_ID: guildId, DISCORD_BOT_TOKEN: botToken } = env
  if (!guildId || !botToken) return []

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    })
    if (!response.ok) return []
    const roles = (await response.json()) as Array<{ id?: string; name?: string; position?: number }>
    return roles
      .filter((role): role is { id: string; name: string; position?: number } => Boolean(role.id && role.name))
      .sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0))
      .map((role) => ({ id: role.id, name: role.name }))
  } catch {
    return []
  }
}

async function fetchPersistedRoles(db: Db): Promise<UserRole[]> {
  const [pointRoles, manualRoles, userRoles] = await Promise.all([
    db.collection("profilerolepoints").find({}, { projection: { roleId: 1, roleName: 1 } }).toArray() as unknown as Promise<Array<{ roleId: string; roleName: string }>>,
    db.collection("playermanualroles").aggregate([
      { $unwind: "$roles" },
      { $match: { "roles.id": { $exists: true, $ne: "" }, "roles.name": { $exists: true, $ne: "" } } },
      { $group: { _id: "$roles.id", name: { $first: "$roles.name" } } },
    ]).toArray() as unknown as Promise<Array<{ _id: string; name: string }>>,
    db.collection("users").aggregate([
      { $unwind: "$roles" },
      { $match: { "roles.id": { $exists: true, $ne: "" }, "roles.name": { $exists: true, $ne: "" } } },
      { $group: { _id: "$roles.id", name: { $first: "$roles.name" } } },
    ]).toArray() as unknown as Promise<Array<{ _id: string; name: string }>>,
  ])

  const byId = new Map<string, UserRole>()
  for (const row of pointRoles) byId.set(row.roleId, { id: row.roleId, name: row.roleName })
  for (const row of manualRoles) byId.set(row._id, { id: row._id, name: row.name })
  for (const row of userRoles) byId.set(row._id, { id: row._id, name: row.name })
  return [...byId.values()]
}

async function getRoleManagerContext(db: Db, discordId: string, env: { DISCORD_GUILD_ID: string; DISCORD_BOT_TOKEN: string }) {
  const { canManage, managerRoles } = await getManagerRoles(db, discordId)
  const guildRoles = await fetchGuildRoles(env)
  const persistedRoles = await fetchPersistedRoles(db)
  const guildById = new Map(guildRoles.map((role) => [role.id, role]))
  const persistedExtras = persistedRoles
    .filter((role) => !guildById.has(role.id))
    .sort((a, b) => a.name.normalize("NFKC").localeCompare(b.name.normalize("NFKC"), "es", { sensitivity: "base" }))
  const availableRoles = guildRoles.length
    ? [...guildRoles, ...persistedExtras]
    : [...managerRoles, ...persistedExtras.filter((role) => !managerRoles.some((entry) => entry.id === role.id))]
  return { canManage, availableRoles }
}

export type ProfileRoleManagerPlayer = {
  playerObjectId: string
  playerId: number
  playerName: string
  country: string
  avatar?: string
  hasRole: boolean
}

export type ProfileRoleManagerData = {
  availableRoles: UserRole[]
  selectedRole: UserRole | null
  selectedRolePoints: number
  rolePointsById: Record<string, number>
  assignedPlayers: ProfileRoleManagerPlayer[]
  searchQuery: string
  searchResults: ProfileRoleManagerPlayer[]
}

export async function getProfileRoleManagerData(
  db: Db,
  discordId: string,
  env: { DISCORD_GUILD_ID: string; DISCORD_BOT_TOKEN: string },
  input?: { roleId?: string | null; query?: string | null }
): Promise<ProfileRoleManagerData> {
  const { availableRoles, canManage } = await getRoleManagerContext(db, discordId, env)
  if (!canManage) throw new Error("You do not have permissions to manage roles.")

  const sortedRoles = availableRoles.filter((role) => role.name.trim().length > 0)
  const selectedRole = sortedRoles.find((role) => role.id === input?.roleId) ?? sortedRoles[0] ?? null
  if (!selectedRole) {
    return { availableRoles: [], selectedRole: null, selectedRolePoints: 0, rolePointsById: {}, assignedPlayers: [], searchQuery: "", searchResults: [] }
  }

  const rolePointsRows = await db.collection("profilerolepoints").find({ roleId: { $in: sortedRoles.map((r) => r.id) } }, { projection: { roleId: 1, points: 1 } }).toArray() as unknown as Array<{ roleId: string; points: number }>
  const rolePointsById = Object.fromEntries(rolePointsRows.map((row) => [row.roleId, Number.isFinite(row.points) ? Number(row.points) : 0]))
  const selectedRolePoints = rolePointsById[selectedRole.id] ?? 0

  const [manualAssignedRows, userAssignedRows] = await Promise.all([
    db.collection("playermanualroles").find({ "roles.id": selectedRole.id }, { projection: { playerId: 1 } }).toArray() as unknown as Promise<Array<{ playerId: ObjectId }>>,
    db.collection("users").find({ "roles.id": selectedRole.id, playerId: { $ne: null } }, { projection: { playerId: 1 } }).toArray() as unknown as Promise<Array<{ playerId?: ObjectId | null }>>,
  ])

  const assignedPlayerIds = new Set<string>()
  for (const row of manualAssignedRows) assignedPlayerIds.add(String(row.playerId))
  for (const row of userAssignedRows) { if (row.playerId) assignedPlayerIds.add(String(row.playerId)) }

  const assignedPlayersRaw = assignedPlayerIds.size
    ? await db.collection("players").find({ _id: { $in: [...assignedPlayerIds].map((id) => new ObjectId(id)) } }, { projection: { player_id: 1, player_name: 1, country: 1, avatar: 1 } }).toArray() as unknown as Array<{ _id: ObjectId; player_id: number; player_name: string; country: string; avatar?: string }>
    : []

  const assignedPlayers: ProfileRoleManagerPlayer[] = assignedPlayersRaw
    .map((p) => ({ playerObjectId: p._id.toString(), playerId: Number(p.player_id), playerName: p.player_name, country: p.country, avatar: p.avatar, hasRole: true }))
    .sort((a, b) => a.playerName.normalize("NFKC").localeCompare(b.playerName.normalize("NFKC"), "es", { sensitivity: "base" }))

  const query = input?.query?.trim() ?? ""
  if (!query) {
    return { availableRoles: sortedRoles, selectedRole, selectedRolePoints, rolePointsById, assignedPlayers, searchQuery: "", searchResults: assignedPlayers }
  }

  const safe = escapeRegex(query)
  const regex = new RegExp(safe, "i")
  const numeric = Number.parseInt(query, 10)

  const searchRows = await db.collection("players").find({
    $or: [{ player_name: { $regex: regex } }, ...(Number.isFinite(numeric) ? [{ player_id: numeric }] : [])],
  }, { projection: { player_id: 1, player_name: 1, country: 1, avatar: 1 } }).toArray() as unknown as Array<{ _id: ObjectId; player_id: number; player_name: string; country: string; avatar?: string }>

  const searchResults: ProfileRoleManagerPlayer[] = searchRows.map((p) => ({
    playerObjectId: p._id.toString(), playerId: Number(p.player_id), playerName: p.player_name, country: p.country, avatar: p.avatar, hasRole: assignedPlayerIds.has(p._id.toString()),
  }))

  return { availableRoles: sortedRoles, selectedRole, selectedRolePoints, rolePointsById, assignedPlayers, searchQuery: query, searchResults }
}

export async function assignProfileRoleToPlayer(db: Db, discordId: string, roleId: string, playerObjectId: string, env: { DISCORD_GUILD_ID: string; DISCORD_BOT_TOKEN: string }) {
  const { availableRoles, canManage } = await getRoleManagerContext(db, discordId, env)
  if (!canManage) throw new Error("You do not have permissions to manage roles.")
  const role = availableRoles.find((e) => e.id === roleId)
  if (!role) throw new Error("Role not found in Discord server roles.")
  if (!ObjectId.isValid(playerObjectId)) throw new Error("Invalid player id.")

  await db.collection("playermanualroles").updateOne(
    { playerId: new ObjectId(playerObjectId) },
    { $addToSet: { roles: role } },
    { upsert: true }
  )
}

export async function removeProfileRoleFromPlayer(db: Db, discordId: string, roleId: string, playerObjectId: string) {
  const { canManage } = await getManagerRoles(db, discordId)
  if (!canManage) throw new Error("You do not have permissions to manage roles.")
  if (!ObjectId.isValid(playerObjectId)) throw new Error("Invalid player id.")

  await db.collection("playermanualroles").updateOne(
    { playerId: new ObjectId(playerObjectId) },
    { $pull: { roles: { id: roleId } } } as any
  )
  await db.collection("playermanualroles").deleteMany({ roles: { $size: 0 } })
}

export async function setProfileRolePoints(db: Db, discordId: string, roleId: string, points: number, env: { DISCORD_GUILD_ID: string; DISCORD_BOT_TOKEN: string }) {
  const { availableRoles, canManage } = await getRoleManagerContext(db, discordId, env)
  if (!canManage) throw new Error("You do not have permissions to manage roles.")
  const role = availableRoles.find((e) => e.id === roleId)
  if (!role) throw new Error("Role not found in Discord server roles.")

  const normalizedPoints = Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : 0
  await db.collection("profilerolepoints").updateOne(
    { roleId: role.id },
    { $set: { roleName: role.name, points: normalizedPoints, updatedByDiscordId: discordId } },
    { upsert: true }
  )
}