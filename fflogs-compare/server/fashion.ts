import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { db } from './db.ts'
import { type AuthEnv, requireAuth } from './auth.ts'
import { BOT_TOKEN, CONTENT_TYPES, type DiscordMessage, discordGet, hasIngestSecret, isObject, isSnowflake, snowflakeTime } from './hunts.ts'
import type { FashionReportInfo } from '../src/types/weekly.ts'

// The week's Fashion Report guide, shown on the Weekly page: the image of an imgur link posted in a Discord channel
// (Kaiyoko's). It gets here like the hunts do:
// - push: the bot POSTs the Discord message to /api/fashion/ingest with HUNT_INGEST_SECRET
// - poll: we read DISCORD_FASHION_CHANNEL_ID ourselves with DISCORD_BOT_TOKEN
// Only the newest guide is kept, and it stays until a newer one comes in (deleting the Discord message doesn't remove
// it), so it's up for the whole judging window.
const CHANNEL_ID = process.env.DISCORD_FASHION_CHANNEL_ID
const POLL_MS = 15 * 60_000
const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const IMAGE_TIMEOUT_MS = 15_000

const pollEnabled = Boolean(BOT_TOKEN && CHANNEL_ID)

type Embed = { url?: string; image?: { url?: string }; thumbnail?: { url?: string } }
// What's read from a message. No author etc.: the MESSAGE_UPDATE that adds the link's embed is a partial message.
type FashionMessage = { id: string; content: string; embeds: Embed[] }

// A forwarded message's text and embeds are in its snapshot
function toFashionMessage(v: unknown): FashionMessage | null {
  if (!isObject(v) || typeof v.id !== 'string' || !isSnowflake(v.id)) return null
  const snapshot = Array.isArray(v.message_snapshots) && isObject(v.message_snapshots[0]) ? v.message_snapshots[0].message : undefined
  const source = isObject(snapshot) ? snapshot : v
  return {
    id: v.id,
    content: typeof source.content === 'string' ? source.content : '',
    embeds: Array.isArray(source.embeds) ? (source.embeds.filter(isObject) as Embed[]) : [],
  }
}

const IMGUR = /^https?:\/\/(i\.)?imgur\.com\//i
// A single image's link: i.imgur.com/<id>.<ext> or imgur.com/<id> (not an album, gallery or tag page)
const IMGUR_LINK = /https?:\/\/(?:i\.)?imgur\.com\/(?!(?:a|gallery|t|user)\/)(\w{5,})(\.\w+)?/i

// The imgur link's embed picture; before Discord has added the embed, straight from the link in the text
function imageUrl(m: FashionMessage): string | null {
  for (const e of m.embeds) {
    const picture = e.image?.url ?? e.thumbnail?.url
    if (picture && (IMGUR.test(picture) || (e.url && IMGUR.test(e.url)))) return picture
  }
  const link = m.content.match(IMGUR_LINK)
  return link ? `https://i.imgur.com/${link[1]}${link[2] ?? '.png'}` : null
}

const newestPostedAt = () => (db.prepare('SELECT MAX(posted_at) AS at FROM fashion_reports').get() as { at: number | null }).at ?? 0

// Fetches and stores the message's image in place of the one kept, unless that one is newer (a backfill sending an
// old message again). The same message again replaces it, so edits go through. False when there's no imgur image;
// throws when it couldn't be fetched.
async function keep(m: FashionMessage): Promise<boolean> {
  const url = imageUrl(m)
  if (!url) return false
  const postedAt = snowflakeTime(m.id)
  if (postedAt < newestPostedAt()) return true
  const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) throw new Error(`Image fetch: ${res.status} ${type}`)
  // A missing image redirects to imgur's "removed" picture rather than failing
  if (res.url.endsWith('/removed.png')) throw new Error(`Image is gone from imgur: ${url}`)
  const data = new Uint8Array(await res.arrayBuffer())
  if (data.byteLength > IMAGE_MAX_BYTES) throw new Error(`Image is ${data.byteLength} bytes`)
  db.prepare('INSERT OR REPLACE INTO fashion_reports (id, content_type, data, posted_at, fetched_at) VALUES (?, ?, ?, ?, ?)').run(
    m.id,
    type,
    data,
    postedAt,
    Date.now(),
  )
  db.prepare('DELETE FROM fashion_reports WHERE id != ?').run(m.id)
  return true
}

const isKept = (id: string) => !!db.prepare('SELECT 1 FROM fashion_reports WHERE id = ?').get(id)

// The channel's newest message with an imgur image, unless we already have it
async function sync() {
  const batch = await discordGet<DiscordMessage[]>(`/channels/${CHANNEL_ID}/messages?limit=20`)
  const newest = batch
    .filter((m) => CONTENT_TYPES.has(m.type))
    .map(toFashionMessage)
    .find((m) => m && imageUrl(m))
  if (newest && !isKept(newest.id)) await keep(newest)
}

export function startFashionSync() {
  if (!pollEnabled) return
  const tick = async () => {
    try {
      await sync()
    } catch (err) {
      console.error('Fashion Report sync failed:', err instanceof Error ? err.message : err)
    }
    setTimeout(tick, POLL_MS).unref()
  }
  void tick()
}

export const fashion = new Hono<AuthEnv>()

// Before requireAuth: the bot uses the shared secret instead of a session. Body: one raw Discord message object,
// from MESSAGE_CREATE or MESSAGE_UPDATE (partial ones are fine). Answers 422 when it has no imgur image, so the bot
// can tell; those messages are ignored.
fashion.post('/ingest', bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
  if (!hasIngestSecret(c.req.header('Authorization'))) return c.json({ error: 'Unauthorized' }, 401)
  const message = toFashionMessage(await c.req.json().catch(() => undefined))
  if (!message) return c.json({ error: 'Expected a Discord message object' }, 400)
  try {
    if (!(await keep(message))) return c.json({ error: 'No imgur image in that message' }, 422)
  } catch (err) {
    console.error(`Fashion Report ingest of ${message.id} failed:`, err instanceof Error ? err.message : err)
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502)
  }
  console.log(`Fashion Report ingest: ${message.id}`)
  return c.body(null, 204)
})

fashion.use(requireAuth)

// The newest guide; the page decides whether it's this week's
fashion.get('/', (c) => {
  const row = db.prepare('SELECT id, posted_at FROM fashion_reports ORDER BY posted_at DESC LIMIT 1').get() as
    | { id: string; posted_at: number }
    | undefined
  const info: FashionReportInfo = { report: row ? { image: `/api/fashion/images/${row.id}`, postedAt: row.posted_at } : null }
  return c.json(info)
})

// The message id is in the link, and an edit refetches under the same id, so the browser only keeps it a while
fashion.get('/images/:id', (c) => {
  const row = db.prepare('SELECT content_type, data FROM fashion_reports WHERE id = ?').get(c.req.param('id')) as
    | { content_type: string; data: Uint8Array }
    | undefined
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.body(row.data as Uint8Array<ArrayBuffer>, 200, { 'Content-Type': row.content_type, 'Cache-Control': 'private, max-age=3600' })
})
