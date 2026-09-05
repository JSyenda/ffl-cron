import type { Env } from "../../lib/env"
import { json } from "../../lib/env"
import { getTttIdentity } from "../../lib/ttt"
import { readStatsIndex, type TttStatEntry } from "../../lib/tttstore"

const rank = (stats: TttStatEntry[], key: "wins" | "games") =>
  [...stats].sort((a, b) => b[key] - a[key] || b.games - a.games)

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const id = await getTttIdentity(env, request)

  try {
    const stats = (await readStatsIndex(env.SESSIONS)).filter((s) => s.games > 0)

    const topWins = rank(stats, "wins")
      .slice(0, 10)
      .map((u) => ({ userId: u.userId, name: u.name, avatar: u.avatar, wins: u.wins, games: u.games }))
    const mostGames = rank(stats, "games")
      .slice(0, 10)
      .map((u) => ({ userId: u.userId, name: u.name, avatar: u.avatar, wins: u.wins, games: u.games }))

    let me: any = null
    if (id) {
      const u = stats.find((s) => s.userId === id.userId)
      if (u) {
        me = {
          userId: u.userId,
          name: u.name,
          avatar: u.avatar,
          wins: u.wins,
          losses: u.losses,
          draws: u.draws,
          games: u.games,
          rankWins: rank(stats, "wins").findIndex((x) => x.userId === u.userId) + 1,
          rankGames: rank(stats, "games").findIndex((x) => x.userId === u.userId) + 1,
        }
      }
    }

    return json({ topWins, mostGames, me })
  } catch (err) {
    console.error("ttt leaderboard error", err)
    return json({ topWins: [], mostGames: [], me: null })
  }
}