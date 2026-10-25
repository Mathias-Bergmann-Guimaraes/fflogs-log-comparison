import { randomBytes } from 'node:crypto'
import { Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { db, transaction } from './db.ts'
import { type AuthEnv, requireAuth, sha256 } from './auth.ts'
import { isObject } from './hunts.ts'
import { claimOwner } from './characters.ts'
import {
  type NewPluginToken,
  type PluginData,
  type PluginEvent,
  type PluginEvents,
  type PluginEventType,
  type PluginGearItem,
  type PluginGearSlot,
  type PluginSnapshotKind,
  type PluginSnapshots,
  type PluginToken,
  PLUGIN_GEAR_SLOTS,
} from '../src/types/plugin.ts'

// Data sent straight from the game by a plugin (Dalamud or similar), stored per account and character.
// The plugin authenticates with a token the user makes on the Settings page, not a session cookie.
// Everything it can send is documented in PLUGIN_API.md at the repo root: keep the two in step.
//   POST /api/plugin/ingest  snapshots (the latest of each kind replaces the one before) and events (appended)
//   GET  /api/plugin/ping    checks the token, for the plugin's "Test connection" button
// Token management and reading the data back use the normal session.

const TOKEN_PREFIX = 'xivc_'
const MAX_TOKENS = 10
// Newest events kept per account; older ones are deleted
const EVENTS_KEEP = 1000
const MAX_EVENTS_PER_REQUEST = 200
const MAX_ITEM_ID = 999_999
const MAX_COUNT = 999_999_999
// An event's time may be this far off now: late (sent from a queue after being offline) or early (clock skew)
const EVENT_MAX_AGE_MS = 30 * 24 * 3_600_000
const CLOCK_SKEW_MS = 5 * 60_000

// --- Validation ---

// Thrown with the path of the bad field, so the plugin's author can see what to fix
class Invalid extends Error {}
const fail = (path: string, expected: string): never => {
  throw new Invalid(`${path}: expected ${expected}`)
}

const int = (v: unknown, path: string, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fail(path, `an integer from ${min} to ${max}`)
const optInt = (v: unknown, path: string, min: number, max: number) => (v == null ? undefined : int(v, path, min, max))
const str = (v: unknown, path: string, max: number) =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : fail(path, `a non-empty string of up to ${max} characters`)
const optStr = (v: unknown, path: string, max: number) => (v == null ? undefined : str(v, path, max))
const bool = (v: unknown, path: string) => (typeof v === 'boolean' ? v : fail(path, 'true or false'))
const obj = (v: unknown, path: string) => (isObject(v) ? v : fail(path, 'an object'))
const list = (v: unknown, path: string, max: number) => (Array.isArray(v) && v.length <= max ? v : fail(path, `an array of up to ${max} entries`))
const itemId = (v: unknown, path: string) => int(v, path, 1, MAX_ITEM_ID)
const job = (v: unknown, path: string) => (typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : fail(path, "a job abbreviation such as 'PLD'"))
const contentId = (v: unknown, path: string) =>
  typeof v === 'string' && /^\d{1,20}$/.test(v) && BigInt(v) > 0n ? v : fail(path, 'the character content id as a decimal string')

function gearItems(v: unknown, path: string): PluginGearItem[] {
  const items = list(v, path, PLUGIN_GEAR_SLOTS.length).map((entry, i) => {
    const p = `${path}[${i}]`
    const o = obj(entry, p)
    const slot = PLUGIN_GEAR_SLOTS.includes(o.slot as PluginGearSlot)
      ? (o.slot as PluginGearSlot)
      : fail(`${p}.slot`, `one of ${PLUGIN_GEAR_SLOTS.join(', ')}`)
    return {
      slot,
      itemId: itemId(o.itemId, `${p}.itemId`),
      hq: o.hq == null ? false : bool(o.hq, `${p}.hq`),
      materia: o.materia == null ? [] : list(o.materia, `${p}.materia`, 5).map((m, j) => itemId(m, `${p}.materia[${j}]`)),
    }
  })
  const slots = items.map((item) => item.slot)
  const twice = slots.find((slot, i) => slots.indexOf(slot) !== i)
  if (twice) fail(path, `each slot at most once ('${twice}' is there twice)`)
  return items
}

// The snapshot kinds a request can carry. `character` isn't one: it's saved from the request's own `character`.
type SentKind = Exclude<PluginSnapshotKind, 'character'>

const SNAPSHOTS: { [K in SentKind]: (o: Record<string, unknown>, path: string) => PluginSnapshots[K] } = {
  jobs: (o, path) => {
    const levels: Record<string, number> = {}
    for (const [key, level] of Object.entries(obj(o.levels, `${path}.levels`))) {
      levels[job(key, `${path}.levels key`)] = int(level, `${path}.levels.${key}`, 1, 200)
    }
    if (Object.keys(levels).length > 50) fail(`${path}.levels`, 'at most 50 jobs')
    return { current: job(o.current, `${path}.current`), levels }
  },

  gear: (o, path) => ({
    job: job(o.job, `${path}.job`),
    itemLevel: optInt(o.itemLevel, `${path}.itemLevel`, 1, 9999),
    items: gearItems(o.items, `${path}.items`),
  }),

  gearsets: (o, path) => {
    const sets = list(o.sets, `${path}.sets`, 100).map((entry, i) => {
      const p = `${path}.sets[${i}]`
      const s = obj(entry, p)
      return {
        index: int(s.index, `${p}.index`, 0, 99),
        name: str(s.name, `${p}.name`, 50),
        job: job(s.job, `${p}.job`),
        itemLevel: optInt(s.itemLevel, `${p}.itemLevel`, 1, 9999),
        items: gearItems(s.items, `${p}.items`),
      }
    })
    return { sets }
  },

  // The same item sent twice is added up, so the plugin can send one entry per bag if that's easier
  inventory: (o, path) => {
    const counts = new Map<number, number>()
    list(o.items, `${path}.items`, 5000).forEach((entry, i) => {
      const p = `${path}.items[${i}]`
      const e = obj(entry, p)
      const id = itemId(e.itemId, `${p}.itemId`)
      counts.set(id, Math.min((counts.get(id) ?? 0) + int(e.count, `${p}.count`, 0, MAX_COUNT), MAX_COUNT))
    })
    return { items: [...counts].map(([id, count]) => ({ itemId: id, count })) }
  },

  weekly: (o, path) => {
    const weekly: PluginSnapshots['weekly'] = {}
    if (o.tomestones != null) {
      const t = obj(o.tomestones, `${path}.tomestones`)
      weekly.tomestones = {
        itemId: optInt(t.itemId, `${path}.tomestones.itemId`, 1, MAX_ITEM_ID),
        earned: int(t.earned, `${path}.tomestones.earned`, 0, 10_000),
        cap: int(t.cap, `${path}.tomestones.cap`, 0, 10_000),
      }
    }
    if (o.wondrousTails != null) {
      const w = obj(o.wondrousTails, `${path}.wondrousTails`)
      weekly.wondrousTails = {
        stickers: int(w.stickers, `${path}.wondrousTails.stickers`, 0, 16),
        secondChancePoints: int(w.secondChancePoints, `${path}.wondrousTails.secondChancePoints`, 0, 9),
      }
    }
    if (o.customDeliveries != null) {
      const d = obj(o.customDeliveries, `${path}.customDeliveries`)
      weekly.customDeliveries = { allowancesLeft: int(d.allowancesLeft, `${path}.customDeliveries.allowancesLeft`, 0, 12) }
    }
    if (o.activities != null) {
      const entries = Object.entries(obj(o.activities, `${path}.activities`))
      if (entries.length > 50) fail(`${path}.activities`, 'at most 50 activities')
      weekly.activities = Object.fromEntries(
        entries.map(([id, value]) => [
          /^\w{1,40}$/.test(id) ? id : fail(`${path}.activities key`, 'an activity id'),
          int(value, `${path}.activities.${id}`, 0, 1 << 20),
        ]),
      )
    }
    return weekly
  },
}

const EVENTS: { [T in PluginEventType]: (o: Record<string, unknown>, path: string) => PluginEvents[T] } = {
  dutyCompleted: (o, path) => ({
    territoryId: int(o.territoryId, `${path}.territoryId`, 1, 65_535),
    contentId: optInt(o.contentId, `${path}.contentId`, 1, 65_535),
    name: str(o.name, `${path}.name`, 100),
    durationMs: optInt(o.durationMs, `${path}.durationMs`, 0, 24 * 3_600_000),
  }),

  loot: (o, path) => ({
    itemId: itemId(o.itemId, `${path}.itemId`),
    count: int(o.count ?? 1, `${path}.count`, 1, MAX_COUNT),
    hq: o.hq == null ? false : bool(o.hq, `${path}.hq`),
    dutyName: optStr(o.dutyName, `${path}.dutyName`, 100),
  }),
}

const isKey = <T extends object>(map: T, key: string): key is Extract<keyof T, string> => Object.hasOwn(map, key)

type Ingest = {
  characterId: string
  character: PluginSnapshots['character']
  capturedAt: number
  snapshots: [SentKind, unknown][]
  events: { type: PluginEventType; clientId: string | null; occurredAt: number; data: unknown }[]
}

function parseIngest(body: unknown, now: number): Ingest {
  const o = obj(body, 'body')
  const c = obj(o.character, 'character')
  const capturedAt = o.sentAt == null ? now : int(o.sentAt, 'sentAt', now - EVENT_MAX_AGE_MS, now + CLOCK_SKEW_MS)

  const snapshots: Ingest['snapshots'] = []
  if (o.snapshots != null) {
    for (const [kind, value] of Object.entries(obj(o.snapshots, 'snapshots'))) {
      if (!isKey(SNAPSHOTS, kind)) fail(`snapshots.${kind}`, `one of ${Object.keys(SNAPSHOTS).join(', ')}`)
      snapshots.push([kind as SentKind, SNAPSHOTS[kind as SentKind](obj(value, `snapshots.${kind}`), `snapshots.${kind}`)])
    }
  }

  const events = (o.events == null ? [] : list(o.events, 'events', MAX_EVENTS_PER_REQUEST)).map((entry, i) => {
    const path = `events[${i}]`
    const e = obj(entry, path)
    const type = typeof e.type === 'string' && isKey(EVENTS, e.type) ? e.type : fail(`${path}.type`, `one of ${Object.keys(EVENTS).join(', ')}`)
    return {
      type,
      clientId: optStr(e.id, `${path}.id`, 64) ?? null,
      occurredAt: e.occurredAt == null ? capturedAt : int(e.occurredAt, `${path}.occurredAt`, now - EVENT_MAX_AGE_MS, now + CLOCK_SKEW_MS),
      data: EVENTS[type](obj(e.data, `${path}.data`), `${path}.data`),
    }
  })

  return {
    characterId: contentId(c.contentId, 'character.contentId'),
    character: {
      name: str(c.name, 'character.name', 40),
      world: str(c.world, 'character.world', 40),
      dataCenter: optStr(c.dataCenter, 'character.dataCenter', 40),
    },
    capturedAt,
    snapshots,
    events,
  }
}

// --- Storage ---

// An older snapshot (sent late, e.g. retried after a newer one) doesn't overwrite a newer one
const UPSERT_SNAPSHOT = db.prepare(
  `INSERT INTO plugin_snapshots (user_id, character_id, kind, data, captured_at, received_at) VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT (user_id, character_id, kind) DO UPDATE SET
     data = excluded.data, captured_at = excluded.captured_at, received_at = excluded.received_at
   WHERE excluded.captured_at >= plugin_snapshots.captured_at`,
)
// OR IGNORE: an event with a client_id already stored is a resend
const INSERT_EVENT = db.prepare(
  `INSERT OR IGNORE INTO plugin_events (user_id, character_id, type, client_id, data, occurred_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
)
const TRIM_EVENTS = db.prepare(
  `DELETE FROM plugin_events WHERE user_id = ? AND id NOT IN
     (SELECT id FROM plugin_events WHERE user_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ${EVENTS_KEEP})`,
)

function store(userId: number, ingest: Ingest, now: number) {
  const { characterId, capturedAt } = ingest
  // Only the snapshots that were newer than the stored ones
  const snapshots: PluginSnapshotKind[] = []
  let events = 0
  transaction(() => {
    for (const [kind, data] of [['character', ingest.character], ...ingest.snapshots] as const) {
      if (UPSERT_SNAPSHOT.run(userId, characterId, kind, JSON.stringify(data), capturedAt, now).changes) snapshots.push(kind)
    }
    for (const e of ingest.events) {
      events += Number(INSERT_EVENT.run(userId, characterId, e.type, e.clientId, JSON.stringify(e.data), e.occurredAt, now).changes)
    }
    if (events) TRIM_EVENTS.run(userId, userId)
  })
  return { snapshots, events, duplicateEvents: ingest.events.length - events }
}

// --- Tokens ---

// The plugin sends `Authorization: Bearer <token>`. Like sessions, only the token's SHA-256 is stored.
const requireToken: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const row = token
    ? (db
        .prepare('SELECT t.id, u.id AS userId, u.username FROM plugin_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?')
        .get(sha256(token)) as { id: number; userId: number; username: string } | undefined)
    : undefined
  if (!row) return c.json({ error: 'Missing, invalid or revoked plugin token' }, 401)
  db.prepare('UPDATE plugin_tokens SET last_used_at = ? WHERE id = ?').run(Date.now(), row.id)
  c.set('user', { id: row.userId, username: row.username })
  await next()
}

type TokenRow = { id: number; name: string; created_at: number; last_used_at: number | null }
const toToken = (r: TokenRow): PluginToken => ({ id: r.id, name: r.name, createdAt: r.created_at, lastUsedAt: r.last_used_at })

export const plugin = new Hono<AuthEnv>()

// --- Plugin side (token) ---

plugin.get('/ping', requireToken, (c) => c.json({ username: c.get('user').username }))

plugin.post('/ingest', bodyLimit({ maxSize: 1024 * 1024 }), requireToken, async (c) => {
  const body = await c.req.json().catch(() => undefined)
  if (body === undefined) return c.json({ error: 'Body must be JSON' }, 400)
  const now = Date.now()
  let ingest: Ingest
  try {
    ingest = parseIngest(body, now)
  } catch (err) {
    if (err instanceof Invalid) return c.json({ error: err.message }, 400)
    throw err
  }
  const userId = c.get('user').id
  // A character verified through the Lodestone (server/characters.ts) only takes data from its own account
  const { name, world } = ingest.character
  const owner = claimOwner(name, world)
  if (owner !== undefined && owner !== userId) return c.json({ error: `${name} (${world}) is claimed by another account` }, 403)
  return c.json({ stored: store(userId, ingest, now) })
})

// --- App side (session) ---

plugin.get('/tokens', requireAuth, (c) => {
  const rows = db
    .prepare('SELECT id, name, created_at, last_used_at FROM plugin_tokens WHERE user_id = ? ORDER BY created_at')
    .all(c.get('user').id) as TokenRow[]
  return c.json(rows.map(toToken))
})

// Body: { name?: string }. The answer is the only time the token is shown.
plugin.post('/tokens', requireAuth, async (c) => {
  const userId = c.get('user').id
  const body = await c.req.json<{ name?: unknown }>().catch(() => ({}) as { name?: unknown })
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 50) : 'Game plugin'
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM plugin_tokens WHERE user_id = ?').get(userId) as { count: number }
  if (count >= MAX_TOKENS) return c.json({ error: `At most ${MAX_TOKENS} tokens; revoke one first` }, 409)

  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  const createdAt = Date.now()
  const { lastInsertRowid } = db
    .prepare('INSERT INTO plugin_tokens (user_id, token_hash, name, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, sha256(token), name, createdAt)
  const created: NewPluginToken = { id: Number(lastInsertRowid), name, createdAt, lastUsedAt: null, token }
  return c.json(created, 201)
})

plugin.delete('/tokens/:id', requireAuth, (c) => {
  const { changes } = db.prepare('DELETE FROM plugin_tokens WHERE id = ? AND user_id = ?').run(Number(c.req.param('id')), c.get('user').id)
  return changes ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
})

// Everything received: the latest snapshots of each character (most recently heard from first) and the newest events
plugin.get('/data', requireAuth, (c) => {
  const userId = c.get('user').id
  const snapshots = db
    .prepare('SELECT character_id, kind, data, captured_at, received_at FROM plugin_snapshots WHERE user_id = ? ORDER BY received_at DESC')
    .all(userId) as { character_id: string; kind: PluginSnapshotKind; data: string; captured_at: number; received_at: number }[]
  const byCharacter = new Map<string, PluginData['characters'][number]>()
  for (const s of snapshots) {
    let character = byCharacter.get(s.character_id)
    if (!character) byCharacter.set(s.character_id, (character = { contentId: s.character_id, snapshots: {} }))
    ;(character.snapshots as Record<string, unknown>)[s.kind] = { data: JSON.parse(s.data), capturedAt: s.captured_at, receivedAt: s.received_at }
  }

  const events = db
    .prepare(
      `SELECT character_id, type, data, occurred_at FROM plugin_events WHERE user_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ${EVENTS_KEEP}`,
    )
    .all(userId) as { character_id: string; type: PluginEventType; data: string; occurred_at: number }[]

  const data: PluginData = {
    characters: [...byCharacter.values()],
    events: events.map((e) => ({ type: e.type, characterId: e.character_id, occurredAt: e.occurred_at, data: JSON.parse(e.data) }) as PluginEvent),
  }
  return c.json(data)
})

// Forgets everything received (tokens stay)
plugin.delete('/data', requireAuth, (c) => {
  const userId = c.get('user').id
  transaction(() => {
    db.prepare('DELETE FROM plugin_snapshots WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM plugin_events WHERE user_id = ?').run(userId)
  })
  return c.body(null, 204)
})
