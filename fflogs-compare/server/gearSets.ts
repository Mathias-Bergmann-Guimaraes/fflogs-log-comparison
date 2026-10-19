import { Hono } from 'hono'
import { db, transaction } from './db.ts'
import { type AuthEnv, requireAuth } from './auth.ts'
import { type BisEnv, bisRoutes, clearSetProgress } from './bis.ts'
import { allJobs } from '../src/constants/gearSharing.ts'

// Custom gear sets: a named group of jobs with an item level range, tracked apart from the default set
// (e.g. the older gear an ultimate is synced to). Each set's BiS progress lives under /gear-sets/:id/bis.

const MAX_NAME = 40
const MAX_ILVL = 999

type Row = { id: number; name: string; jobs: string; min_ilvl: number; max_ilvl: number }
type GearSet = { id: number; name: string; jobs: string[]; minIlvl: number; maxIlvl: number }

const toGearSet = (row: Row): GearSet => ({ id: row.id, name: row.name, jobs: JSON.parse(row.jobs), minIlvl: row.min_ilvl, maxIlvl: row.max_ilvl })

function findSet(userId: number, id: number): GearSet | undefined {
  const row = db.prepare('SELECT id, name, jobs, min_ilvl, max_ilvl FROM gear_sets WHERE user_id = ? AND id = ?').get(userId, id) as Row | undefined
  return row && toGearSet(row)
}

const isIlvl = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_ILVL

// Checks a create/update body; jobs come back deduplicated and in role order
function parseBody(body: { name?: unknown; jobs?: unknown; minIlvl?: unknown; maxIlvl?: unknown }): Omit<GearSet, 'id'> | string {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > MAX_NAME) return `Name must be 1-${MAX_NAME} characters`
  if (!Array.isArray(body.jobs) || !body.jobs.length || !body.jobs.every((j) => allJobs.includes(j))) return 'Pick at least one job'
  if (!isIlvl(body.minIlvl) || !isIlvl(body.maxIlvl)) return `Item levels must be whole numbers from 1 to ${MAX_ILVL}`
  if (body.minIlvl > body.maxIlvl) return "The lowest item level can't be above the highest"
  const jobs = allJobs.filter((j) => (body.jobs as unknown[]).includes(j))
  return { name, jobs, minIlvl: body.minIlvl, maxIlvl: body.maxIlvl }
}

export const gearSets = new Hono<AuthEnv>()
gearSets.use(requireAuth)

// Oldest first, so tabs keep the order they were made in
gearSets.get('/', (c) => {
  const rows = db.prepare('SELECT id, name, jobs, min_ilvl, max_ilvl FROM gear_sets WHERE user_id = ? ORDER BY id').all(c.get('user').id) as Row[]
  return c.json(rows.map(toGearSet))
})

// Body: { name, jobs, minIlvl, maxIlvl }; responds with the new set
gearSets.post('/', async (c) => {
  const parsed = parseBody(await c.req.json())
  if (typeof parsed === 'string') return c.json({ error: parsed }, 400)
  const { lastInsertRowid } = db
    .prepare('INSERT INTO gear_sets (user_id, name, jobs, min_ilvl, max_ilvl, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(c.get('user').id, parsed.name, JSON.stringify(parsed.jobs), parsed.minIlvl, parsed.maxIlvl, Date.now())
  return c.json({ id: Number(lastInsertRowid), ...parsed }, 201)
})

// Same body as POST. Jobs taken out of the set lose their progress in it.
gearSets.put('/:id{[0-9]+}', async (c) => {
  const userId = c.get('user').id
  const existing = findSet(userId, Number(c.req.param('id')))
  if (!existing) return c.json({ error: 'Gear set not found' }, 404)
  const parsed = parseBody(await c.req.json())
  if (typeof parsed === 'string') return c.json({ error: parsed }, 400)

  const removed = existing.jobs.filter((j) => !parsed.jobs.includes(j))
  transaction(() => {
    db.prepare('UPDATE gear_sets SET name = ?, jobs = ?, min_ilvl = ?, max_ilvl = ? WHERE user_id = ? AND id = ?').run(
      parsed.name,
      JSON.stringify(parsed.jobs),
      parsed.minIlvl,
      parsed.maxIlvl,
      userId,
      existing.id,
    )
    if (removed.length) clearSetProgress(userId, existing.id, removed)
  })
  return c.json({ id: existing.id, ...parsed })
})

gearSets.delete('/:id{[0-9]+}', (c) => {
  const userId = c.get('user').id
  const existing = findSet(userId, Number(c.req.param('id')))
  if (!existing) return c.json({ error: 'Gear set not found' }, 404)
  transaction(() => {
    clearSetProgress(userId, existing.id)
    db.prepare('DELETE FROM gear_sets WHERE user_id = ? AND id = ?').run(userId, existing.id)
  })
  return c.body(null, 204)
})

// The set's BiS progress: the same routes as /bis, scoped to this set and its jobs
const setBis = new Hono<BisEnv>()
setBis.use(async (c, next) => {
  const set = findSet(c.get('user').id, Number(c.req.param('id')))
  if (!set) return c.json({ error: 'Gear set not found' }, 404)
  c.set('setId', set.id)
  c.set('setJobs', set.jobs)
  await next()
})
setBis.route('/', bisRoutes())
gearSets.route('/:id{[0-9]+}/bis', setBis)
