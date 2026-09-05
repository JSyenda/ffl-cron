// mongo-gw: minimal MongoDB gateway for Pages Functions.
//
// The Pages Functions bundler (old esbuild) cannot compile the mongodb
// driver (static {} blocks), so ALL driver code runs here (plain Node on
// Netlify) while Pages keeps every route handler and talks to this
// endpoint over HTTPS with a shared secret. See ffl-full functions/lib
// remote-db.ts (client side) for the matching EJSON shape.
//
// Request (POST, JSON): { op, collection, ... } or { batch: [ ... ] }
// Response: { ok: true, result } or { ok: false, error }
// EJSON markers (nested anywhere): { $oid: "<24hex>" }, { $date: "<iso>" }

import { MongoClient, ObjectId } from "mongodb"

const ALLOW_COLLECTIONS = new Set([
  "users",
  "players",
  "playercompetitions",
  "teamcompetitions",
  "teams",
  "wordleresults",
  "eloplayers",
  "appmeta",
  "profilerolepoints",
  "playermanualroles",
  "goals",
  "tttgames",
  "tttusers",
])

const ALLOW_OPS = new Set([
  "findOne",
  "find",
  "aggregate",
  "insertOne",
  "updateOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
])

let cachedClient = null

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 15000,
    })
    await cachedClient.connect()
  }
  return cachedClient.db("FFL")
}

function revive(v) {
  if (Array.isArray(v)) return v.map(revive)
  if (v && typeof v === "object") {
    if (typeof v.$oid === "string" && Object.keys(v).length === 1) return new ObjectId(v.$oid)
    if (typeof v.$date === "string" && Object.keys(v).length === 1) return new Date(v.$date)
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = revive(val)
    return out
  }
  return v
}

function serialize(v) {
  if (v instanceof ObjectId) return { $oid: v.toHexString() }
  if (v instanceof Date) return { $date: v.toISOString() }
  if (Array.isArray(v)) return v.map(serialize)
  if (v && typeof v === "object") {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = serialize(val)
    return out
  }
  return v
}

async function runOne(db, job) {
  const { op, collection } = job
  if (!ALLOW_OPS.has(op)) throw new Error(`op not allowed: ${op}`)
  if (!ALLOW_COLLECTIONS.has(collection)) throw new Error(`collection not allowed: ${collection}`)
  const c = db.collection(collection)
  switch (op) {
    case "findOne": {
      const { filter = {}, projection } = job
      return await c.findOne(revive(filter), projection ? { projection } : {})
    }
    case "find": {
      const { filter = {}, projection, sort, limit } = job
      let cur = c.find(revive(filter), projection ? { projection } : {})
      if (sort) cur = cur.sort(sort)
      if (typeof limit === "number") cur = cur.limit(limit)
      return await cur.toArray()
    }
    case "aggregate": {
      const { pipeline = [] } = job
      return await c.aggregate(revive(pipeline)).toArray()
    }
    case "insertOne": {
      const r = await c.insertOne(revive(job.doc))
      return { insertedId: r.insertedId }
    }
    case "updateOne": {
      const { filter, update, upsert } = job
      const r = await c.updateOne(revive(filter), revive(update), { upsert: !!upsert })
      return { matched: r.matchedCount, modified: r.modifiedCount, upsertedId: r.upsertedId ?? null }
    }
    case "deleteOne": {
      const r = await c.deleteOne(revive(job.filter))
      return { deleted: r.deletedCount }
    }
    case "deleteMany": {
      const r = await c.deleteMany(revive(job.filter))
      return { deleted: r.deletedCount }
    }
    case "findOneAndUpdate": {
      const { filter, update } = job
      return await c.findOneAndUpdate(revive(filter), revive(update))
    }
    default:
      throw new Error(`unknown op: ${op}`)
  }
}

export async function handler(event) {
  try {
    if (!process.env.GW_SECRET) return { statusCode: 500, body: JSON.stringify({ ok: false, error: "gateway not configured" }) }
    const secret = event.headers?.["x-gw-secret"] ?? event.headers?.["X-Gw-Secret"]
    if (secret !== process.env.GW_SECRET) return { statusCode: 403, body: JSON.stringify({ ok: false, error: "forbidden" }) }
    if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ ok: false, error: "method not allowed" }) }
    const body = JSON.parse(event.body || "{}")
    const db = await getDb()
    if (Array.isArray(body.batch)) {
      const results = []
      for (const job of body.batch) results.push(serialize(await runOne(db, job)))
      return { statusCode: 200, body: JSON.stringify({ ok: true, results }) }
    }
    const result = serialize(await runOne(db, body))
    return { statusCode: 200, body: JSON.stringify({ ok: true, result }) }
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) }
  }
}
