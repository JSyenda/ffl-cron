import type { Env } from "../../../lib/env"
import { json } from "../../../lib/env"
import {
  getTttIdentity,
  WIN_COORDS,
  cellKeyForCoord,
} from "../../../lib/ttt"
import { getDb, getGame, saveGame, clearUserGame, recordTttResultKv } from "../../../lib/tttstore"
import { recordTttResult } from "../../../lib/tttresult"

const TURN_TIMEOUT_MS = 45 * 1000
const GAME_CANCEL_MS = 5 * 60 * 1000
const GAME_MAX_DURATION_MS = 90 * 60 * 1000

async function finishAndRecord(env: Env, kv: any, game: any, waitUntil?: (p: Promise<unknown>) => void) {
  // Persist the finished game first. The win/draw must be visible to both
  // players right away; the result write to Mongo is best-effort and must never
  // sit in front of saveGame (a slow/hung Mongo connection made the winning
  // move look like clicking "did nothing" while nothing was persisted).
  await saveGame(kv, game)
  for (const p of game.players) {
    await clearUserGame(kv, p.userId).catch(() => {})
  }
  if (game.resultRecorded) return
  await recordTttResultKv(kv, game).catch((err) => console.error("ttt record KV failed", err))
  const record = (async () => {
    try {
      const db = await getDb(env)
      await recordTttResult(db, game)
      game.resultRecorded = true
      await saveGame(kv, game).catch(() => {})
    } catch (err) {
      console.error("ttt recordTttResult failed", err)
    }
  })()
  if (waitUntil) waitUntil(record)
  else await record
}

// Resolve a stale turn before serving any request. The 5-minute "no first move
// yet" cancel ends the game; a 45-second turn timeout simply passes the turn to
// the other player so the match never gets stuck. Returns true when the game
// was finished.
async function resolveTimeout(
  env: Env,
  kv: any,
  game: any,
  now: number,
  waitUntil?: (p: Promise<unknown>) => void
): Promise<boolean> {
  if (game.status !== "playing") return false

  // Hard cap: no match can run longer than 90 minutes. Whichever player claimed
  // the most squares wins; an exact tie in claims cancels the match, which means
  // it never counts as a played game. Runs before the per-turn checks so it also
  // resolves any game that somehow survived without a first move.
  if (now - (game.createdAt || now) > GAME_MAX_DURATION_MS) {
    game.status = "finished"
    game.timeFinished = true
    const claims: Record<string, number> = {}
    for (const m of Object.values(game.moves)) {
      if (m && typeof (m as any).by === "string") {
        const by = (m as any).by as string
        claims[by] = (claims[by] || 0) + 1
      }
    }
    const ranked = Object.keys(claims).sort((a, b) => (claims[b] || 0) - (claims[a] || 0))
    const top = ranked[0]
    const second = ranked[1]
    if (top && (!second || claims[top] !== claims[second])) {
      game.winnerUserId = top
      game.cancelled = false
    } else {
      game.winnerUserId = null
      game.cancelled = true
    }
    await finishAndRecord(env, kv, game, waitUntil)
    return true
  }

  if (!game.firstMoveMade) {
    if (now - (game.createdAt || now) > GAME_CANCEL_MS) {
      game.status = "finished"
      game.cancelled = true
      game.winnerUserId = null
      await finishAndRecord(env, kv, game, waitUntil)
      return true
    }
    return false
  }

  const base = game.turnStartedAt || 0
  if (base && now - base > TURN_TIMEOUT_MS) {
    const other = game.players.find((p: any) => p.userId !== game.turnUserId)
    if (other && other.userId !== game.turnUserId) {
      game.turnUserId = other.userId
      game.turnStartedAt = now
      game.turnPassed = true
      await saveGame(kv, game)
    }
  }
  return false
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = await getTttIdentity(context.env, context.request)
  if (!id) return json({ error: "identity required" }, 401)

  const gameId = String(context.params.gameId)
  const kv = context.env.SESSIONS
  const game = await getGame(kv, gameId)
  if (!game) return json({ error: "game not found" }, 404)

  await resolveTimeout(context.env, kv, game, Date.now(), context.waitUntil)

  return json({ ...game, youUserId: id.userId })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const id = await getTttIdentity(context.env, context.request)
  if (!id) return json({ error: "identity required" }, 401)

  const gameId = String(context.params.gameId)
  const kv = context.env.SESSIONS
  const game = await getGame(kv, gameId)
  if (!game) return json({ error: "game not found" }, 404)

  // Resolve a stale turn before accepting any move so a timed-out player can
  // never keep the game blocked or sneak in a move after the clock ran out.
  const now = Date.now()
  const timedOut = await resolveTimeout(context.env, kv, game, now, context.waitUntil)
  if (timedOut) return json({ ...game, youUserId: id.userId }, 409)
  if (game.status !== "playing") return json({ error: "game finished" }, 400)
  if (game.turnUserId !== id.userId) return json({ error: "not your turn" }, 403)

  const body = await context.request.json().catch(() => ({}))
  const { cellKey, playerObjectId, playerName, teamName, avatar, kitImage, teamImage, country } = body as {
    cellKey?: string
    playerObjectId?: string
    playerName?: string
    teamName?: string
    avatar?: string
    kitImage?: string
    teamImage?: string
    country?: string
  }

  const cell = (game.board.cells || []).find((c: any) => c.key === cellKey)
  if (!cell) return json({ error: "invalid cell" }, 400)
  if (game.moves[cellKey as string]) return json({ error: "cell already filled" }, 400)

  const valid = (cell.options || []).some((o: any) => o.playerObjectId === playerObjectId)
  if (!valid) return json({ error: "wrong pick" }, 400)

  const used = Object.values(game.moves).some((m: any) => m.playerObjectId === playerObjectId)
  if (used) return json({ error: "that player is already on the board" }, 400)

  game.moves[cellKey as string] = {
    by: id.userId,
    playerObjectId,
    playerName,
    teamName,
    avatar,
    kitImage,
    teamImage,
    country,
  }

  // Three-in-a-row is decided by who solved the squares: a line only counts when
  // every cell in it was claimed by the player who just moved.
  let winner: string | null = null
  let winningKeys: string[] = []
  for (const line of WIN_COORDS) {
    const keys = line.map(([r, c]) => cellKeyForCoord(game.board, r, c)).filter(Boolean) as string[]
    const m = keys.map((k) => game.moves[k])
    if (m.every(Boolean) && m.every((x) => x.by === id.userId)) {
      winner = id.userId
      winningKeys = keys
      break
    }
  }

  const filled = Object.keys(game.moves).length
  if (winner) {
    game.status = "finished"
    game.winnerUserId = winner
    game.winningLineKeys = winningKeys
  } else if (filled >= 9) {
    game.status = "finished"
    game.winnerUserId = null
    game.winningLineKeys = []
  } else {
    game.turnUserId = game.players.find((p: any) => p.userId !== id.userId).userId
    game.turnStartedAt = Date.now()
    game.firstMoveMade = true
  }

  if (game.status === "finished") {
    await finishAndRecord(context.env, kv, game, context.waitUntil)
  } else {
    await saveGame(kv, game)
  }

  return json({ ...game, youUserId: id.userId })
}