import type { Env } from "../../../../lib/env"
import { json } from "../../../../lib/env"
import { getTttIdentity } from "../../../../lib/ttt"
import { getDb, getGame, saveGame, clearUserGame, recordTttResultKv } from "../../../../lib/tttstore"
import { recordTttResult } from "../../../../lib/tttresult"
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const id = await getTttIdentity(context.env, context.request)
  if (!id) return json({ error: "identity required" }, 401)

  const gameId = String(context.params.gameId)
  const kv = context.env.SESSIONS
  const game = await getGame(kv, gameId)
  if (!game) return json({ error: "game not found" }, 404)
  if (game.status !== "playing") {
    return json({ ...game, youUserId: id.userId })
  }

  const isParticipant = game.players.some((p: any) => p.userId === id.userId)
  if (!isParticipant) return json({ error: "not a participant" }, 403)

  if (!game.firstMoveMade) {
    // No move has been made yet: cancel the match, nobody wins or loses.
    game.status = "finished"
    game.cancelled = true
    game.winnerUserId = null
  } else {
    // At least one move was played: the player who leaves forfeits.
    const opponent = game.players.find((p: any) => p.userId !== id.userId)
    game.status = "finished"
    game.winnerUserId = opponent ? opponent.userId : null
    game.forfeited = true
    game.forfeitedBy = id.userId
  }

  for (const p of game.players) {
    await clearUserGame(kv, p.userId).catch(() => {})
  }
  if (game.forfeited && !game.resultRecorded) {
    await recordTttResultKv(kv, game).catch((err) => console.error("ttt leave record KV failed", err))
    try {
      const db = await getDb(context.env)
      await recordTttResult(db, game)
      game.resultRecorded = true
    } catch (err) {
      console.error("ttt leave recordTttResult failed", err)
    }
  }
  await saveGame(kv, game)

  return json({ ...game, youUserId: id.userId })
}
