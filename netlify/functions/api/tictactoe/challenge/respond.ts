import type { Env } from "../../../lib/env"
import { json } from "../../../lib/env"
import { getTttIdentity, genId } from "../../../lib/ttt"
import { getChallenge, deleteChallenge, saveGame, setUserGame, GAME_TTL } from "../../../lib/tttstore"

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const id = await getTttIdentity(context.env, context.request)
  if (!id) return json({ error: "identity required" }, 401)

  const body = await context.request.json().catch(() => ({}))
  const { challengeId, action } = body as { challengeId?: string; action?: string }

  const db = context.env.SESSIONS
  const ch = challengeId ? await getChallenge(db, challengeId) : null
  if (!ch) return json({ error: "challenge not found" }, 404)

  if (action === "decline") {
    await deleteChallenge(db, challengeId as string)
    return json({ ok: true })
  }

  if (action === "accept") {
    if (ch.toUserId !== id.userId) return json({ error: "not addressed to you" }, 403)
    if (ch.expiresAt < Date.now()) {
      await deleteChallenge(db, challengeId as string)
      return json({ error: "challenge expired" }, 404)
    }
    const gameId = genId(12)
    const game = {
      id: gameId,
      board: ch.board,
      players: [
        { userId: ch.fromUserId, displayName: ch.fromName, avatar: ch.fromAvatar ?? null },
        { userId: ch.toUserId, displayName: ch.toName, avatar: id.avatar ?? null },
      ],
      playerColors: { [ch.fromUserId]: "blue", [ch.toUserId]: "red" },
      turnUserId: ch.fromUserId,
      moves: {},
      status: "playing",
      winnerUserId: null,
      firstMoveMade: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + GAME_TTL * 1000,
    }
    await saveGame(db, game)
    await setUserGame(db, ch.fromUserId, gameId)
    await setUserGame(db, ch.toUserId, gameId)
    await deleteChallenge(db, challengeId as string)
    return json({ gameId })
  }

  return json({ error: "invalid action" }, 400)
}
