import { createHash, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { db, transaction } from './db.ts'
import { type AuthEnv, requireAuth } from './auth.ts'
import { requireFeature } from './features.ts'
import type { HuntAttachment, HuntEmbed, HuntMessage, HuntMeta, HuntPage, HuntRank, HuntSRankList, HuntTrainList } from '../src/types/hunts.ts'

// Messages of one Discord channel, stored in hunt_messages. They get here either way (or both):
// - push: another bot that can see the channel POSTs each message to /api/hunts/ingest with a shared secret
// - poll: we read the channel ourselves through the REST API with our own bot token
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const CHANNEL_ID = process.env.DISCORD_HUNT_CHANNEL_ID
const POLL_MS = Math.max(5, Number(process.env.DISCORD_POLL_SECONDS ?? 20)) * 1000
const INGEST_SECRET = process.env.HUNT_INGEST_SECRET
// S rank spawns are only worth showing while recent: only the newest this many are shown, older ones are
// hidden (not deleted)
const S_RANK_KEEP = 20

const pollEnabled = Boolean(BOT_TOKEN && CHANNEL_ID)
// Short secrets are ignored rather than accepted, so a placeholder value can't open the endpoint
const pushEnabled = (INGEST_SECRET?.length ?? 0) >= 16
export const huntsEnabled = pollEnabled || pushEnabled

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_EPOCH = 1420070400000n
const PAGE_SIZE = 50

// Only the parts of Discord's message object we use
type DiscordMessage = {
  id: string
  channel_id?: string
  // Not Discord's: a pushing bot adds it, since messages only carry the channel id
  channel_name?: string
  type: number
  content: string
  edited_timestamp: string | null
  author: { id: string; username: string; global_name?: string | null; avatar: string | null }
  // Only on gateway events (what a pushing bot receives), not on REST reads
  member?: { nick?: string | null }
  embeds: {
    title?: string
    description?: string
    url?: string
    color?: number
    author?: { name: string }
    footer?: { text: string }
    thumbnail?: { url: string }
    image?: { url: string }
    fields?: { name: string; value: string; inline?: boolean }[]
  }[]
  attachments: { url: string; filename: string; content_type?: string }[]
  // Set on messages sent with Discord's Forward button, which have no content of their own
  message_snapshots?: { message: Pick<DiscordMessage, 'content' | 'embeds' | 'attachments' | 'edited_timestamp'> }[]
}

// Default, reply and slash-command messages; joins, pins, thread notices etc. are skipped
const CONTENT_TYPES = new Set([0, 19, 20])

const snowflakeTime = (id: string) => Number((BigInt(id) >> 22n) + DISCORD_EPOCH)
const isSnowflake = (id: string | undefined): id is string => !!id && /^\d{1,20}$/.test(id)

// Mentions only ping from the content, never from embeds. Followed (crossposted) messages keep the raw
// <@&id> of the hunt server's roles, which can't be resolved to names from here, so they're labelled client side.
function extractPings(content: string): string[] {
  const pings = new Set<string>()
  for (const [, id] of content.matchAll(/<@&(\d+)>/g)) pings.add(`role:${id}`)
  if (content.includes('@everyone')) pings.add('@everyone')
  if (content.includes('@here')) pings.add('@here')
  return [...pings]
}

function toEmbed(e: DiscordMessage['embeds'][number]): HuntEmbed {
  return {
    title: e.title,
    description: e.description,
    url: e.url,
    color: e.color,
    author: e.author?.name,
    footer: e.footer?.text,
    thumbnail: e.thumbnail?.url,
    image: e.image?.url,
    fields: (e.fields ?? []).map((f) => ({ name: f.name, value: f.value, inline: !!f.inline })),
  }
}

const UPSERT = db.prepare(
  `INSERT INTO hunt_messages
     (id, channel_id, channel_name, author_name, author_icon, content, embeds, attachments, pings, created_at, edited_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT (id) DO UPDATE SET
     channel_id = COALESCE(excluded.channel_id, channel_id), channel_name = COALESCE(excluded.channel_name, channel_name),
     content = excluded.content, embeds = excluded.embeds, attachments = excluded.attachments,
     pings = excluded.pings, edited_at = excluded.edited_at`,
)

function save(m: DiscordMessage) {
  // Followed messages arrive through a webhook named after the source server and channel. Forwarded ones are
  // authored by whoever forwarded them; the original's text is in the snapshot (which has no author).
  const icon = m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : null
  const source = m.message_snapshots?.[0]?.message ?? m
  const attachments: HuntAttachment[] = source.attachments.map((a) => ({
    url: a.url,
    filename: a.filename,
    isImage: !!a.content_type?.startsWith('image/'),
  }))
  UPSERT.run(
    m.id,
    m.channel_id ?? CHANNEL_ID ?? null,
    m.channel_name ?? null,
    m.member?.nick ?? m.author.global_name ?? m.author.username,
    icon,
    source.content,
    JSON.stringify(source.embeds.map(toEmbed)),
    JSON.stringify(attachments),
    JSON.stringify(extractPings(source.content)),
    snowflakeTime(m.id),
    source.edited_timestamp ? Date.parse(source.edited_timestamp) : null,
  )
}

async function discordGet<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${DISCORD_API}${path}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}`, 'User-Agent': 'DiscordBot (ffxiv-companion, 1.0)' },
    })
    if (res.status === 429) {
      const { retry_after } = (await res.json()) as { retry_after: number }
      await new Promise((resolve) => setTimeout(resolve, retry_after * 1000))
      continue
    }
    if (!res.ok) throw new Error(`Discord API ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return (await res.json()) as T
  }
  throw new Error('Discord API kept rate limiting')
}

let newestId: string | undefined
let lastSyncAt: number | null = null
let syncError: string | null = null

const maxId = (ids: string[]) => ids.reduce((a, b) => (BigInt(a) > BigInt(b) ? a : b))

// First run on an empty table takes just the latest 100 messages; after that it pages forward from the
// newest stored one, so nothing posted while the server was down is missed. Edits to older messages aren't picked up.
async function sync() {
  if (newestId === undefined) {
    const rows = db.prepare('SELECT id FROM hunt_messages ORDER BY created_at DESC LIMIT 20').all() as { id: string }[]
    if (rows.length) newestId = maxId(rows.map((r) => r.id))
  }
  for (;;) {
    const query = newestId ? `?limit=100&after=${newestId}` : '?limit=100'
    const batch = await discordGet<DiscordMessage[]>(`/channels/${CHANNEL_ID}/messages${query}`)
    if (!batch.length) break
    transaction(() => batch.filter((m) => CONTENT_TYPES.has(m.type)).forEach(save))
    const backfill = newestId === undefined
    newestId = maxId(batch.map((m) => m.id))
    if (backfill || batch.length < 100) break
  }
}

export function startHuntSync() {
  if (!pollEnabled) return
  const tick = async () => {
    try {
      await sync()
      lastSyncAt = Date.now()
      syncError = null
    } catch (err) {
      syncError = err instanceof Error ? err.message : String(err)
      console.error('Hunt sync failed:', syncError)
    }
    setTimeout(tick, POLL_MS).unref()
  }
  void tick()
}

type Row = {
  id: string
  channel_id: string | null
  channel_name: string | null
  author_name: string
  author_icon: string | null
  content: string
  embeds: string
  attachments: string
  pings: string
  created_at: number
  edited_at: number | null
}

// A and S rank channels are told apart by name: "s-rank" anywhere ("chaos-s-ranks") or a leading "S " ("S Light")
// is S rank; the same with "a", or "train" anywhere ("light-trains", A ranks are hunted in trains), is A rank.
// Anything else has no rank and only shows on the All notifications page.
const RANK_PATTERNS: [HuntRank, RegExp][] = [
  ['S', /(^|[\s_-])s[\s_-]?ranks?($|[\s_-])|^s[\s_-]/i],
  ['A', /(^|[\s_-])a[\s_-]?ranks?($|[\s_-])|^a[\s_-]|train/i],
]

function channelRank(name: string | null): HuntRank | null {
  if (!name) return null
  return RANK_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? null
}

function channelIdsByRank(): Record<HuntRank, string[]> {
  const rows = db.prepare('SELECT DISTINCT channel_id, channel_name FROM hunt_messages WHERE channel_name IS NOT NULL').all() as {
    channel_id: string
    channel_name: string
  }[]
  const ids = { A: new Set<string>(), S: new Set<string>() }
  for (const r of rows) {
    const rank = channelRank(r.channel_name)
    if (rank) ids[rank].add(r.channel_id)
  }
  return { A: [...ids.A], S: [...ids.S] }
}

const parseRank = (rank: string | undefined): HuntRank | null => (rank === 'A' || rank === 'S' ? rank : null)
const placeholders = (values: unknown[]) => values.map(() => '?').join(', ')

const toMessage = (r: Row): HuntMessage => ({
  id: r.id,
  channelId: r.channel_id,
  channelName: r.channel_name,
  authorName: r.author_name,
  authorIcon: r.author_icon,
  content: r.content,
  embeds: JSON.parse(r.embeds),
  attachments: JSON.parse(r.attachments),
  pings: JSON.parse(r.pings),
  createdAt: r.created_at,
  editedAt: r.edited_at,
})

// --- Push ---

let lastPushAt: number | null = null

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Checks the fields save() relies on; the rest of Discord's message object is optional and read defensively
function toDiscordMessage(v: unknown): DiscordMessage | null {
  if (!isObject(v) || typeof v.id !== 'string' || !isSnowflake(v.id)) return null
  if (!isObject(v.author) || typeof v.author.id !== 'string' || typeof v.author.username !== 'string') return null
  const list = (x: unknown) => (Array.isArray(x) ? x.filter(isObject) : [])
  const snapshots = list(v.message_snapshots)
    .map((s) => s.message)
    .filter(isObject)
    .map((s) => ({
      message: {
        content: typeof s.content === 'string' ? s.content : '',
        embeds: list(s.embeds),
        attachments: list(s.attachments),
        edited_timestamp: typeof s.edited_timestamp === 'string' ? s.edited_timestamp : null,
      },
    }))
  return {
    ...(v as unknown as DiscordMessage),
    channel_id: typeof v.channel_id === 'string' && isSnowflake(v.channel_id) ? v.channel_id : undefined,
    channel_name: typeof v.channel_name === 'string' && v.channel_name.trim() ? v.channel_name.trim().slice(0, 100) : undefined,
    type: typeof v.type === 'number' ? v.type : 0,
    content: typeof v.content === 'string' ? v.content : '',
    edited_timestamp: typeof v.edited_timestamp === 'string' ? v.edited_timestamp : null,
    embeds: list(v.embeds) as DiscordMessage['embeds'],
    attachments: list(v.attachments) as DiscordMessage['attachments'],
    message_snapshots: snapshots.length ? (snapshots as DiscordMessage['message_snapshots']) : undefined,
  }
}

// Compared as hashes so the comparison takes the same time whatever the input's length
function hasIngestSecret(header: string | undefined) {
  if (!pushEnabled || !header?.startsWith('Bearer ')) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(header.slice(7)), digest(INGEST_SECRET!))
}

export const hunts = new Hono<AuthEnv>()

// Registered before requireAuth, which would otherwise answer first: these use the shared secret instead of a session.
// Body: one raw Discord message object (as in a MESSAGE_CREATE / MESSAGE_UPDATE gateway event), or an array of them.
// Sending a message again replaces the stored copy, so edits can go through here too.
hunts.post('/ingest', bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
  if (!hasIngestSecret(c.req.header('Authorization'))) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json().catch(() => undefined)
  const messages = (Array.isArray(body) ? body : [body]).map(toDiscordMessage)
  if (!messages.length || messages.some((m) => !m)) return c.json({ error: 'Expected a Discord message object or an array of them' }, 400)
  transaction(() => (messages as DiscordMessage[]).filter((m) => CONTENT_TYPES.has(m.type)).forEach(save))
  lastPushAt = Date.now()
  const first = messages[0]!
  console.log(`Hunt ingest: ${messages.length} message(s), first ${first.id} in #${first.channel_name ?? first.channel_id ?? '?'}`)
  return c.body(null, 204)
})

// For MESSAGE_DELETE events
hunts.delete('/ingest/:id', (c) => {
  if (!hasIngestSecret(c.req.header('Authorization'))) return c.json({ error: 'Unauthorized' }, 401)
  db.prepare('DELETE FROM hunt_messages WHERE id = ?').run(c.req.param('id'))
  return c.body(null, 204)
})

// --- Reading ---

hunts.use(requireAuth, requireFeature('hunts'))

// Newest first. ?before=<message id> for the next page, ?after=<message id> for anything newer (one page, oldest
// dropped if there's more), ?ping=<ping> (repeatable) to keep only messages with any of those pings,
// ?channel=<channel id> (repeatable) to keep only those channels. Both filters together must both match.
// ?rank=A|S keeps only that rank's channels. S rank messages past the newest S_RANK_KEEP are always left out.
hunts.get('/', (c) => {
  const before = c.req.query('before')
  const after = c.req.query('after')
  const pings = c.req.queries('ping') ?? []
  const channels = (c.req.queries('channel') ?? []).filter(isSnowflake)
  const rank = parseRank(c.req.query('rank'))
  const rankIds = channelIdsByRank()

  const where: string[] = []
  const params: (string | number)[] = []
  if (isSnowflake(before)) {
    where.push('(created_at, id) < (?, ?)')
    params.push(snowflakeTime(before), before)
  }
  if (isSnowflake(after)) {
    where.push('(created_at, id) > (?, ?)')
    params.push(snowflakeTime(after), after)
  }
  if (pings.length) {
    where.push(`EXISTS (SELECT 1 FROM json_each(pings) WHERE value IN (${pings.map(() => '?').join(', ')}))`)
    params.push(...pings)
  }
  if (channels.length) {
    where.push(`channel_id IN (${channels.map(() => '?').join(', ')})`)
    params.push(...channels)
  }
  if (rank) {
    // No channel of that rank seen yet: nothing matches
    where.push(rankIds[rank].length ? `channel_id IN (${placeholders(rankIds[rank])})` : '0')
    params.push(...rankIds[rank])
  }
  if (rankIds.S.length) {
    const sIn = `channel_id IN (${placeholders(rankIds.S)})`
    where.push(
      `(channel_id IS NULL OR NOT ${sIn} OR id IN (SELECT id FROM hunt_messages WHERE ${sIn} ORDER BY created_at DESC, id DESC LIMIT ${S_RANK_KEEP}))`,
    )
    params.push(...rankIds.S, ...rankIds.S)
  }

  const rows = db
    .prepare(
      `SELECT * FROM hunt_messages ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id DESC LIMIT ${PAGE_SIZE + 1}`,
    )
    .all(...params) as Row[]

  const page: HuntPage = { messages: rows.slice(0, PAGE_SIZE).map(toMessage), hasMore: rows.length > PAGE_SIZE }
  return c.json(page)
})

// Every A rank message for the Hunt Dashboard, which parses world, start time and conductor out of the text.
// The last train of a world can be months back, so this isn't paged; the cap only guards against runaway growth.
const TRAINS_LIMIT = 10_000

hunts.get('/trains', (c) => {
  const ids = channelIdsByRank().A
  const rows = ids.length
    ? (db
        .prepare(
          `SELECT id, channel_name, content, pings, created_at FROM hunt_messages
           WHERE channel_id IN (${placeholders(ids)}) ORDER BY created_at DESC LIMIT ${TRAINS_LIMIT}`,
        )
        .all(...ids) as Pick<Row, 'id' | 'channel_name' | 'content' | 'pings' | 'created_at'>[])
    : []
  const list: HuntTrainList = {
    enabled: huntsEnabled,
    messages: rows.map((r) => ({
      id: r.id,
      channelName: r.channel_name,
      content: r.content,
      pings: JSON.parse(r.pings),
      createdAt: r.created_at,
    })),
  }
  return c.json(list)
})

// The S rank spawns for the Hunt Dashboard: the last day's, for its cards (only recent ones show) and its per-hour
// chart. Older than the S rank pages show, but only this far back; the cap only guards against runaway growth.
const S_RANKS_SINCE_MS = 24 * 3_600_000
const S_RANKS_LIMIT = 2_000

hunts.get('/sranks', (c) => {
  const ids = channelIdsByRank().S
  const rows = ids.length
    ? (db
        .prepare(
          `SELECT id, channel_name, content, embeds, created_at FROM hunt_messages
           WHERE channel_id IN (${placeholders(ids)}) AND created_at > ?
           ORDER BY created_at DESC, id DESC LIMIT ${S_RANKS_LIMIT}`,
        )
        .all(...ids, Date.now() - S_RANKS_SINCE_MS) as Pick<Row, 'id' | 'channel_name' | 'content' | 'embeds' | 'created_at'>[])
    : []
  const list: HuntSRankList = {
    enabled: huntsEnabled,
    messages: rows.map((r) => ({
      id: r.id,
      channelName: r.channel_name,
      content: r.content,
      embeds: JSON.parse(r.embeds),
      createdAt: r.created_at,
    })),
  }
  return c.json(list)
})

// ?rank=A|S limits the pings and channels to that rank's channels, like the list above
hunts.get('/meta', (c) => {
  const rank = parseRank(c.req.query('rank'))
  const rankIds = rank ? channelIdsByRank()[rank] : []
  const scope = rank ? (rankIds.length ? `m.channel_id IN (${placeholders(rankIds)})` : '0') : '1'

  const pings = db
    .prepare(
      `SELECT p.value AS ping, COUNT(*) AS count, MAX(m.created_at) AS lastAt
       FROM hunt_messages m, json_each(m.pings) p WHERE ${scope} GROUP BY p.value ORDER BY lastAt DESC`,
    )
    .all(...rankIds) as HuntMeta['pings']
  // Sorted by name, so "A Light" / "S Light" etc. keep a fixed order
  const channels = db
    .prepare(
      `SELECT channel_id AS id, COUNT(*) AS count, MAX(created_at) AS lastAt,
         (SELECT channel_name FROM hunt_messages n WHERE n.channel_id = m.channel_id AND n.channel_name IS NOT NULL
          ORDER BY n.created_at DESC LIMIT 1) AS name
       FROM hunt_messages m WHERE channel_id IS NOT NULL AND ${scope} GROUP BY channel_id ORDER BY name IS NULL, name`,
    )
    .all(...rankIds) as HuntMeta['channels']
  const meta: HuntMeta = {
    enabled: huntsEnabled,
    polling: pollEnabled,
    lastSyncAt: pollEnabled ? lastSyncAt : null,
    syncError,
    lastPushAt,
    pings,
    channels,
  }
  return c.json(meta)
})
