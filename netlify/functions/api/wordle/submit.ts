import type { Env } from "../../lib/env"
import { json } from "../../lib/env"

interface PagesFunctionEnv extends Env {}

// DEPRECATED: Guess validation and reward granting are now handled by /api/wordle/guess
// This endpoint is kept as a no-op for backwards compatibility
export const onRequestPost: PagesFunction<PagesFunctionEnv> = async () => {
  return json({ ok: true, deprecated: true })
}
