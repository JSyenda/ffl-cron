import type { Db } from "mongodb"
import { getMongoDb } from "./mongodb"

export interface TttUserStats {
  _id: string
  name: string | null
  avatar: string | null
  wins: number
  losses: number
  draws: number
  games: number
}

// Update per-user cumulative stats when a game finishes.
export async function recordTttResult(db: Db, game: any): Promise<void> {
  // Cancelled matches never count as games played: no result is recorded at all.
  if (game.cancelled) return
  const users = db.collection<TttUserStats>("tttusers")
  const players: any[] = game.players || []
  const winnerId: string | null = game.winnerUserId || null
  const now = new Date()

  if (winnerId) {
    const winner = players.find((p) => p.userId === winnerId)
    const loser = players.find((p) => p.userId !== winnerId)
    if (winner) {
      await users.updateOne(
        { _id: winner.userId },
        {
          $set: { name: winner.displayName || null, avatar: winner.avatar || null },
          $inc: { wins: 1, games: 1 },
        },
        { upsert: true }
      )
    }
    if (loser) {
      await users.updateOne(
        { _id: loser.userId },
        {
          $set: { name: loser.displayName || null, avatar: loser.avatar || null },
          $inc: { losses: 1, games: 1 },
        },
        { upsert: true }
      )
    }
  } else {
    for (const p of players) {
      await users.updateOne(
        { _id: p.userId },
        {
          $set: { name: p.displayName || null, avatar: p.avatar || null },
          $inc: { draws: 1, games: 1 },
        },
        { upsert: true }
      )
    }
  }

  await db.collection("tttgames").updateOne(
    { _id: game.id },
    {
      $set: {
        gameId: game.id,
        winnerUserId: winnerId,
        players: players.map((p: any) => ({ userId: p.userId, name: p.displayName })),
        finishedAt: now,
      },
    },
    { upsert: true }
  )
}

export interface LeaderboardEntry {
  userId: string
  name: string | null
  avatar: string | null
  wins: number
  games: number
}

export async function getLeaderboard(db: Db): Promise<{
  topWins: LeaderboardEntry[]
  mostGames: LeaderboardEntry[]
}> {
  const all = await db.collection<TttUserStats>("tttusers").find({ games: { $gt: 0 } }).toArray()
  const topWins = [...all]
    .sort((a, b) => b.wins - a.wins || b.games - a.games)
    .slice(0, 10)
    .map((u) => ({
      userId: u._id,
      name: u.name,
      avatar: u.avatar,
      wins: u.wins,
      games: u.games,
    }))
  const mostGames = [...all]
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 10)
    .map((u) => ({
      userId: u._id,
      name: u.name,
      avatar: u.avatar,
      wins: u.wins,
      games: u.games,
    }))
  return { topWins, mostGames }
}
