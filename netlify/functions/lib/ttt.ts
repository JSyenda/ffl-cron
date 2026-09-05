import { getSessionFromRequest } from "./auth"
import type { Env } from "./env"

export interface TttIdentity {
  userId: string
  displayName: string
  avatar?: string | null
  kind: "discord"
}

// Online play requires an authenticated Discord session.
export async function getTttIdentity(env: Env, request: Request): Promise<TttIdentity | null> {
  const session = await getSessionFromRequest(env.SESSIONS, request)
  if (!session?.discordId) return null
  return {
    userId: `discord:${session.discordId}`,
    displayName: session.name || "Discord user",
    avatar: session.image || null,
    kind: "discord",
  }
}

export const PRESENCE_TTL = 60
export const CHALLENGE_TTL = 180
export const GAME_TTL = 7200

export const presenceKey = (userId: string) => `ttt:presence:${userId}`
export const presenceRosterKey = () => `ttt:roster`
export const challengeKey = (id: string) => `ttt:challenge:${id}`
export const challengeIndexKey = (userId: string) => `ttt:idx:challenge:${userId}`
export const gameKey = (id: string) => `ttt:game:${id}`
export const userGameKey = (userId: string) => `ttt:usergame:${userId}`

export function genId(len = 12): string {
  const a = new Uint8Array(len)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, len)
}

export const WIN_COORDS: Array<Array<[number, number]>> = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
]

export function cellKeyForCoord(board: any, r: number, c: number): string | null {
  const cell = (board?.cells || []).find((cell: any) => cell.row === r && cell.col === c)
  return cell ? cell.key : null
}
