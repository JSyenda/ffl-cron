import { getMongoDb } from "./mongodb"

// Mongo-backed replacement for the Cloudflare KVNamespace used by Pages
// Functions. Same minimal surface the codebase already uses:
// get(key) / put(key, value, { expirationTtl }) / delete(key).
// Sessions, tictactoe realtime state and stats all live here now.

export interface MongoKV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

const COLLECTION = "kvstore"
let indexPromise: Promise<unknown> | null = null

async function col(mongoUri: string) {
  const db = await getMongoDb(mongoUri)
  const c = db.collection(COLLECTION)
  if (!indexPromise) {
    // expireAfterSeconds: 0 => documents expire exactly at `expiresAt`.
    // Documents without expiresAt (or null) never expire.
    indexPromise = c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  }
  await indexPromise
  return c
}

export function getMongoKv(mongoUri: string): MongoKV {
  return {
    async get(key: string): Promise<string | null> {
      const c = await col(mongoUri)
      const doc = (await c.findOne({ _id: key })) as { v?: unknown; expiresAt?: Date | null } | null
      if (!doc) return null
      if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) return null
      return typeof doc.v === "string" ? doc.v : JSON.stringify(doc.v ?? null)
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
      const c = await col(mongoUri)
      const ttl = opts?.expirationTtl
      await c.updateOne(
        { _id: key },
        {
          $set: {
            _id: key,
            v: value,
            updatedAt: new Date(),
            expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : null,
          },
        },
        { upsert: true }
      )
    },
    async delete(key: string): Promise<void> {
      const c = await col(mongoUri)
      await c.deleteOne({ _id: key })
    },
  }
}
