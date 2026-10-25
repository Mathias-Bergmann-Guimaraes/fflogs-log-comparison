import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db, transaction } from './db.ts'
import { type AuthEnv, requireAuth } from './auth.ts'
import type { CharacterClaims, ClaimedCharacter, LodestoneCharacter, PendingClaim } from '../src/types/characters.ts'

// Claiming a character: proof that the account's owner can edit the character's Lodestone profile.
//   POST   /api/characters                 { lodestone: <link or id> } hands out a code for that character
//   POST   /api/characters/:id/verify      reads the character's Lodestone page; the code in its profile text claims it
//   DELETE /api/characters/:id             drops the claim (or the code waiting for it)
//   GET    /api/characters                 the account's claims and codes
//   POST   /api/characters/:id/refresh     reads a claimed character's name, world and portrait again
//   PUT    /api/characters/fflogs          { lodestoneId: <id> | null } picks the claimed character FF Logs features use
// A character belongs to one account at a time: verifying it from another account moves it there. The game plugin
// (server/plugin.ts) refuses data for a character another account has claimed. The FF Logs character can only be one
// of the account's claims, so linking FF Logs needs the same proof; FF Logs finds it by its Lodestone id.

const LODESTONE = 'https://na.finalfantasyxiv.com/lodestone/character'
const USER_AGENT = 'Mozilla/5.0 (compatible; ffxiv-companion/1.0)'
const LODESTONE_TIMEOUT_MS = 15_000
// Between two Lodestone reads for the same account, so the button can't be used to hammer it
const LODESTONE_COOLDOWN_MS = 5_000
const CODE_TTL_MS = 24 * 3_600_000
const CODE_PREFIX = 'XIVC-'
// 32 letters and digits that can't be mistaken for each other (no 0/O, 1/I); 256 is a multiple of 32, so no bias
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_PENDING = 10

class LodestoneError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    message: string,
  ) {
    super(message)
  }
}

const newCode = () => CODE_PREFIX + [...randomBytes(8)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

// A Lodestone character link (any region's site) or just the number in it
function parseLodestoneId(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  const id = /^\d{1,12}$/.test(s) ? s : /finalfantasyxiv\.com\/lodestone\/character\/(\d{1,12})/i.exec(s)?.[1]
  return id && Number(id) > 0 ? String(Number(id)) : undefined
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (html: string) =>
  html
    .replace(/&#(x?)([\da-f]+);/gi, (_, hex: string, n: string) => String.fromCodePoint(parseInt(n, hex ? 16 : 10)))
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .trim()

// A pattern for an element's opening tag by one of its classes (a regex alternative). The class attribute may hold other
// classes and stray spaces: some pages have class="character__character_profile ".
const openTag = (element: string, classes: string) => `<${element}\\b[^>]*\\bclass="(?:[^"]*\\s)?(?:${classes})(?:\\s[^"]*)?"[^>]*>`

// The character's page: who it is, and the text of its Character Profile (where the code goes)
async function readLodestone(lodestoneId: string): Promise<{ character: LodestoneCharacter; profile: string }> {
  let res: Response
  try {
    res = await fetch(`${LODESTONE}/${lodestoneId}/`, {
      headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(LODESTONE_TIMEOUT_MS),
    })
  } catch {
    throw new LodestoneError(502, "Couldn't reach the Lodestone; try again in a moment")
  }
  if (res.status === 404) throw new LodestoneError(404, `There's no character ${lodestoneId} on the Lodestone`)
  if (res.status === 503) throw new LodestoneError(503, 'The Lodestone is down (maintenance?); try again later')
  if (!res.ok) throw new LodestoneError(502, `The Lodestone answered ${res.status}; try again in a moment`)

  const html = await res.text()
  const name = new RegExp(`${openTag('p', 'frame__chara__name')}([^<]*)</p>`).exec(html)?.[1]
  // "Twintania [Light]", after the home world icon
  const world = new RegExp(`${openTag('p', 'frame__chara__world')}(?:<i[^>]*></i>)?([^<]*)</p>`).exec(html)?.[1]
  // The Lodestone serves two layouts of the page (which one seems to depend on its cache); the profile text's class differs
  const profile = new RegExp(`${openTag('div', 'character__selfintroduction|character__character_profile')}([\\s\\S]*?)</div>`).exec(html)?.[1]
  // The portrait, only kept when it's one of the Lodestone's own images
  const face = new RegExp(`${openTag('div', 'frame__chara__face')}\\s*<img\\b[^>]*\\bsrc="([^"]+)"`).exec(html)?.[1]
  const avatar = face && /^https:\/\/[\w-]+\.finalfantasyxiv\.com\//.test(face) ? decode(face) : undefined
  if (!name || !world || profile === undefined) {
    const missing = [!name && 'name', !world && 'home world', profile === undefined && 'Character Profile'].filter(Boolean)
    throw new LodestoneError(502, `Couldn't find the ${missing.join(', ')} on the character's Lodestone page`)
  }

  const [, worldName, dataCenter] = /^(.*?)\s*(?:\[(.*)\])?$/.exec(decode(world))!
  return {
    character: { lodestoneId, name: decode(name), world: worldName!, dataCenter: dataCenter || undefined, avatar },
    profile: decode(profile.replace(/<[^>]*>/g, ' ')),
  }
}

// The account that has claimed the character with this name on this home world, if any. A character renamed or moved
// since its claim was verified still goes by its old name here until it's verified again.
export function claimOwner(name: string, world: string): number | undefined {
  const row = db
    .prepare(`SELECT user_id FROM character_claims WHERE name = ? COLLATE NOCASE AND world = ? COLLATE NOCASE ORDER BY verified_at DESC LIMIT 1`)
    .get(name, world) as { user_id: number } | undefined
  return row?.user_id
}

type CharacterRow = { lodestone_id: string; name: string; world: string; data_center: string | null; avatar: string | null }
type ClaimRow = CharacterRow & { verified_at: number; fflogs: number }
type CodeRow = CharacterRow & { code: string; created_at: number }
const CLAIM_COLUMNS = 'lodestone_id, name, world, data_center, avatar, verified_at, fflogs'
const CODE_COLUMNS = 'lodestone_id, name, world, data_center, avatar, code, created_at'

const toCharacter = (r: CharacterRow): LodestoneCharacter => ({
  lodestoneId: r.lodestone_id,
  name: r.name,
  world: r.world,
  dataCenter: r.data_center ?? undefined,
  avatar: r.avatar ?? undefined,
})
const toClaimed = (r: ClaimRow): ClaimedCharacter => ({ ...toCharacter(r), verifiedAt: r.verified_at, fflogs: r.fflogs === 1 })
const toPending = (r: CodeRow): PendingClaim => ({ ...toCharacter(r), code: r.code, createdAt: r.created_at, expiresAt: r.created_at + CODE_TTL_MS })

const lastRead = new Map<number, number>()
// Reads the Lodestone for the account, at most once per cooldown
function readLodestoneFor(userId: number, lodestoneId: string) {
  const now = Date.now()
  if (now - (lastRead.get(userId) ?? 0) < LODESTONE_COOLDOWN_MS) {
    throw new LodestoneError(429, 'Wait a few seconds before checking the Lodestone again')
  }
  lastRead.set(userId, now)
  return readLodestone(lodestoneId)
}

export const characters = new Hono<AuthEnv>()
characters.use(requireAuth)

characters.onError((err, c) => {
  if (err instanceof LodestoneError) return c.json({ error: err.message }, err.status)
  throw err
})

characters.get('/', (c) => {
  const userId = c.get('user').id
  db.prepare('DELETE FROM claim_codes WHERE user_id = ? AND created_at <= ?').run(userId, Date.now() - CODE_TTL_MS)
  const claimed = db.prepare(`SELECT ${CLAIM_COLUMNS} FROM character_claims WHERE user_id = ? ORDER BY verified_at`).all(userId) as ClaimRow[]
  const pending = db.prepare(`SELECT ${CODE_COLUMNS} FROM claim_codes WHERE user_id = ? ORDER BY created_at`).all(userId) as CodeRow[]
  const result: CharacterClaims = { claimed: claimed.map(toClaimed), pending: pending.map(toPending) }
  return c.json(result)
})

// Body: { lodestone: <character link or id> }. Hands out the code to put in the character's Lodestone profile; asking
// again for the same character gives the same code while it's valid.
characters.post('/', async (c) => {
  const userId = c.get('user').id
  const body = await c.req.json<{ lodestone?: unknown }>().catch(() => ({}) as { lodestone?: unknown })
  const lodestoneId = parseLodestoneId(body.lodestone)
  if (!lodestoneId) return c.json({ error: 'Not a Lodestone character link, e.g. https://na.finalfantasyxiv.com/lodestone/character/12345678/' }, 400)
  if (db.prepare('SELECT 1 FROM character_claims WHERE lodestone_id = ? AND user_id = ?').get(lodestoneId, userId)) {
    return c.json({ error: 'You have claimed this character already' }, 409)
  }

  const now = Date.now()
  const existing = db.prepare(`SELECT ${CODE_COLUMNS} FROM claim_codes WHERE user_id = ? AND lodestone_id = ?`).get(userId, lodestoneId) as
    | CodeRow
    | undefined
  if (existing && existing.created_at > now - CODE_TTL_MS) return c.json(toPending(existing))

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM claim_codes WHERE user_id = ? AND created_at > ?').get(userId, now - CODE_TTL_MS) as {
    count: number
  }
  if (count >= MAX_PENDING) return c.json({ error: `At most ${MAX_PENDING} claims can wait at once; finish or cancel one first` }, 409)

  // Checks the character exists, and gets its name to show next to the code
  const { character } = await readLodestoneFor(userId, lodestoneId)
  const code = newCode()
  db.prepare(
    `INSERT OR REPLACE INTO claim_codes (user_id, lodestone_id, name, world, data_center, avatar, code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, lodestoneId, character.name, character.world, character.dataCenter ?? null, character.avatar ?? null, code, now)
  const pending: PendingClaim = { ...character, code, createdAt: now, expiresAt: now + CODE_TTL_MS }
  return c.json(pending, 201)
})

// The "I've updated my Lodestone" button: the character is the account's once its profile has the code
characters.post('/:id/verify', async (c) => {
  const userId = c.get('user').id
  const lodestoneId = parseLodestoneId(c.req.param('id'))
  const pending = lodestoneId
    ? (db.prepare('SELECT code, created_at FROM claim_codes WHERE user_id = ? AND lodestone_id = ?').get(userId, lodestoneId) as
        | { code: string; created_at: number }
        | undefined)
    : undefined
  if (!lodestoneId || !pending || pending.created_at <= Date.now() - CODE_TTL_MS) {
    return c.json({ error: 'No code waiting for this character (they last a day); start the claim again' }, 404)
  }

  const { character, profile } = await readLodestoneFor(userId, lodestoneId)
  if (!profile.toUpperCase().includes(pending.code)) {
    return c.json(
      { error: `${pending.code} isn't in ${character.name}'s Lodestone profile yet. Save it there, wait a minute, and check again.` },
      422,
    )
  }

  const verifiedAt = Date.now()
  // The account's first FF Logs character is the first one it claims. Moved from another account, it stops being theirs.
  const fflogs = transaction(() => {
    const hasFFLogs = db.prepare('SELECT 1 FROM character_claims WHERE user_id = ? AND fflogs = 1 AND lodestone_id <> ?').get(userId, lodestoneId)
    db.prepare(
      `INSERT OR REPLACE INTO character_claims (lodestone_id, user_id, name, world, data_center, avatar, verified_at, fflogs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(lodestoneId, userId, character.name, character.world, character.dataCenter ?? null, character.avatar ?? null, verifiedAt, hasFFLogs ? 0 : 1)
    db.prepare('DELETE FROM claim_codes WHERE user_id = ? AND lodestone_id = ?').run(userId, lodestoneId)
    return !hasFFLogs
  })
  const claimed: ClaimedCharacter = { ...character, verifiedAt, fflogs }
  return c.json(claimed)
})

// A claimed character's name, world and portrait as the Lodestone shows them now (after a rename, a world transfer or a
// new look). The claim itself stays: only the code proves ownership.
characters.post('/:id/refresh', async (c) => {
  const userId = c.get('user').id
  const lodestoneId = parseLodestoneId(c.req.param('id')) ?? ''
  if (!db.prepare('SELECT 1 FROM character_claims WHERE lodestone_id = ? AND user_id = ?').get(lodestoneId, userId)) {
    return c.json({ error: 'Not found' }, 404)
  }
  const { character } = await readLodestoneFor(userId, lodestoneId)
  const row = db
    .prepare(
      `UPDATE character_claims SET name = ?, world = ?, data_center = ?, avatar = ? WHERE lodestone_id = ? AND user_id = ? RETURNING ${CLAIM_COLUMNS}`,
    )
    .get(character.name, character.world, character.dataCenter ?? null, character.avatar ?? null, lodestoneId, userId) as ClaimRow | undefined
  return row ? c.json(toClaimed(row)) : c.json({ error: 'Not found' }, 404)
})

// Body: { lodestoneId: <a claimed character's id> | null }. null: no FF Logs character.
characters.put('/fflogs', async (c) => {
  const userId = c.get('user').id
  const body = await c.req.json<{ lodestoneId?: unknown }>().catch(() => ({}) as { lodestoneId?: unknown })
  const lodestoneId = body.lodestoneId === null ? null : parseLodestoneId(body.lodestoneId)
  if (lodestoneId === undefined) return c.json({ error: 'lodestoneId: expected a Lodestone id or null' }, 400)
  if (lodestoneId && !db.prepare('SELECT 1 FROM character_claims WHERE lodestone_id = ? AND user_id = ?').get(lodestoneId, userId)) {
    return c.json({ error: 'Claim the character first' }, 404)
  }
  transaction(() => {
    db.prepare('UPDATE character_claims SET fflogs = 0 WHERE user_id = ? AND fflogs = 1').run(userId)
    if (lodestoneId) db.prepare('UPDATE character_claims SET fflogs = 1 WHERE lodestone_id = ? AND user_id = ?').run(lodestoneId, userId)
  })
  return c.body(null, 204)
})

characters.delete('/:id', (c) => {
  const userId = c.get('user').id
  const lodestoneId = parseLodestoneId(c.req.param('id')) ?? ''
  const changes = transaction(
    () =>
      Number(db.prepare('DELETE FROM character_claims WHERE lodestone_id = ? AND user_id = ?').run(lodestoneId, userId).changes) +
      Number(db.prepare('DELETE FROM claim_codes WHERE lodestone_id = ? AND user_id = ?').run(lodestoneId, userId).changes),
  )
  return changes ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
})
