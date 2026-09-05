import type { Env } from "../../lib/env"
import { json } from "../../lib/env"
import { getTttIdentity, genId } from "../../lib/ttt"
import { createChallenge, CHALLENGE_TTL } from "../../lib/tttstore"

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const id = await getTttIdentity(context.env, context.request)
  if (!id) return json({ error: "identity required" }, 401)

  const body = await context.request.json().catch(() => ({}))
  const { targetUserId, targetName, board, difficulty } = body as {
    targetUserId?: string
    targetName?: string
    board?: any
    difficulty?: string
  }

  if (!targetUserId || !board || !Array.isArray(board.cells) || board.cells.length !== 9) {
    return json({ error: "missing target or board" }, 400)
  }

  const challengeId = genId(12)
  const ch = {
    id: challengeId,
    fromUserId: id.userId,
    fromName: id.displayName,
    fromAvatar: id.avatar ?? null,
    toUserId: String(targetUserId),
    toName: targetName ? String(targetName) : "",
    board,
    difficulty: difficulty || "medium",
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_TTL * 1000,
  }
  const db = context.env.SESSIONS
  await createChallenge(db, ch)
  return json({ challengeId })
}
