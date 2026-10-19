import { type Context, Hono } from 'hono'
import { db, transaction } from './db.ts'
import { type User, requireAuth } from './auth.ts'
import { SLOT_COUNT, allJobs, sharedSlots } from '../src/constants/gearSharing.ts'

// Kept in sync by hand with EquipmentStatus in src/types/EquipmentType.ts
const VALID_STATUSES = new Set(['raid', 'tome', 'twine', 'glaze', 'solvent', 'dungeon', 'relic', 'trial', 'ultimate', 'acquired'])

// The piece a status is after. 'acquired' keeps the slot's current source instead (see the upsert below);
// a slot with no row yet was on the default Raid status.
const sourceOf = (status: string) =>
  status === 'tome' || status === 'twine' || status === 'glaze' || status === 'solvent'
    ? 'tome'
    : status === 'dungeon' || status === 'relic' || status === 'trial' || status === 'ultimate'
      ? status
      : 'raid'

// Params: user_id, set_id, job, slot_index, status, source, updated_at. An 'acquired' slot keeps the source it already had.
const UPSERT_SLOT = `INSERT INTO bis_slots (user_id, set_id, job, slot_index, status, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (user_id, set_id, job, slot_index) DO UPDATE SET
    status = excluded.status,
    source = CASE WHEN excluded.status = 'acquired' THEN bis_slots.source ELSE excluded.source END,
    updated_at = excluded.updated_at`

// Params: user_id, set_id, job, slot_index, item_id, updated_at. A slot with no row yet stays on the default Raid status.
const UPSERT_ITEM = `INSERT INTO bis_slots (user_id, set_id, job, slot_index, status, source, item_id, updated_at) VALUES (?, ?, ?, ?, 'raid', 'raid', ?, ?)
  ON CONFLICT (user_id, set_id, job, slot_index) DO UPDATE SET item_id = excluded.item_id, updated_at = excluded.updated_at`

// Which gear set the routes below work on: 0 is the default set, anything else a gear_sets row (server/gearSets.ts).
// setJobs: the jobs that set tracks, so other jobs can't be written to it.
export type BisEnv = { Variables: { user: User; setId: number; setJobs: readonly string[] } }
type Scope = { userId: number; setId: number }

const isSlot = (slot: unknown): slot is number => Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < SLOT_COUNT
const isItemId = (id: unknown): id is number | null => id === null || (Number.isInteger(id) && (id as number) > 0 && (id as number) < 10_000_000)

function groupOf({ userId, setId }: Scope, job: string, slot: number): number | undefined {
  const row = db
    .prepare('SELECT group_id FROM slot_links WHERE user_id = ? AND set_id = ? AND job = ? AND slot_index = ?')
    .get(userId, setId, job, slot) as { group_id: number } | undefined
  return row?.group_id
}

// The job itself plus every job linked to it on this slot
function jobsSharingSlot(scope: Scope, job: string, slot: number): string[] {
  const groupId = groupOf(scope, job, slot)
  if (groupId === undefined) return [job]
  const rows = db
    .prepare('SELECT job FROM slot_links WHERE user_id = ? AND set_id = ? AND slot_index = ? AND group_id = ?')
    .all(scope.userId, scope.setId, slot, groupId) as { job: string }[]
  return rows.map((r) => r.job)
}

// Removes the job's slot from its group; a group left with one member is dissolved
function unlinkSlot(scope: Scope, job: string, slot: number) {
  const { userId, setId } = scope
  const groupId = groupOf(scope, job, slot)
  if (groupId === undefined) return
  db.prepare('DELETE FROM slot_links WHERE user_id = ? AND set_id = ? AND job = ? AND slot_index = ?').run(userId, setId, job, slot)
  db.prepare(
    `DELETE FROM slot_links WHERE user_id = ? AND set_id = ? AND slot_index = ? AND group_id = ?
     AND (SELECT COUNT(*) FROM slot_links WHERE user_id = ? AND set_id = ? AND slot_index = ? AND group_id = ?) = 1`,
  ).run(userId, setId, slot, groupId, userId, setId, slot, groupId)
}

// target's slot joins source's slot group and takes on source's status and piece
function linkSlot(scope: Scope, source: string, target: string, slot: number) {
  const { userId, setId } = scope
  let groupId = groupOf(scope, source, slot)
  if (groupId !== undefined && groupOf(scope, target, slot) === groupId) return

  unlinkSlot(scope, target, slot)
  const insert = db.prepare('INSERT INTO slot_links (user_id, set_id, job, slot_index, group_id) VALUES (?, ?, ?, ?, ?)')
  if (groupId === undefined) {
    const { next } = db
      .prepare('SELECT COALESCE(MAX(group_id), 0) + 1 AS next FROM slot_links WHERE user_id = ? AND set_id = ? AND slot_index = ?')
      .get(userId, setId, slot) as { next: number }
    groupId = next
    insert.run(userId, setId, source, slot, groupId)
  }
  insert.run(userId, setId, target, slot, groupId)

  db.prepare('DELETE FROM bis_slots WHERE user_id = ? AND set_id = ? AND job = ? AND slot_index = ?').run(userId, setId, target, slot)
  db.prepare(
    `INSERT INTO bis_slots (user_id, set_id, job, slot_index, status, source, item_id, updated_at)
     SELECT user_id, set_id, ?, slot_index, status, source, item_id, ? FROM bis_slots WHERE user_id = ? AND set_id = ? AND job = ? AND slot_index = ?`,
  ).run(target, Date.now(), userId, setId, source, slot)
}

// Deletes a set's progress and links for these jobs (all of them when `jobs` is omitted), dissolving groups left with one member
export function clearSetProgress(userId: number, setId: number, jobs?: readonly string[]) {
  const forJobs = jobs ? ` AND job IN (${jobs.map(() => '?').join(', ')})` : ''
  const params = [userId, setId, ...(jobs ?? [])]
  db.prepare(`DELETE FROM bis_slots WHERE user_id = ? AND set_id = ?${forJobs}`).run(...params)
  db.prepare(`DELETE FROM slot_links WHERE user_id = ? AND set_id = ?${forJobs}`).run(...params)
  db.prepare(
    `DELETE FROM slot_links WHERE user_id = ? AND set_id = ? AND (slot_index, group_id) IN (
       SELECT slot_index, group_id FROM slot_links WHERE user_id = ? AND set_id = ? GROUP BY slot_index, group_id HAVING COUNT(*) = 1)`,
  ).run(userId, setId, userId, setId)
}

// BiS progress routes for one gear set, picked by the setId/setJobs a middleware in front of them sets
export function bisRoutes() {
  const routes = new Hono<BisEnv>()
  const scopeOf = (c: Context<BisEnv>): Scope => ({ userId: c.get('user').id, setId: c.get('setId') })

  // slots: only what the user has changed, { [job]: { [slotIndex]: status } }
  // sources: the same slots, { [job]: { [slotIndex]: 'raid' | 'tome' | 'dungeon' | 'relic' | 'trial' | 'ultimate' } }
  // items: slots pinned to a specific item, { [job]: { [slotIndex]: itemId } }
  // links: linked slots only, { [job]: { [slotIndex]: groupId } }; same slot + same id = shared
  routes.get('/', (c) => {
    const { userId, setId } = scopeOf(c)
    const slotRows = db
      .prepare('SELECT job, slot_index, status, source, item_id FROM bis_slots WHERE user_id = ? AND set_id = ?')
      .all(userId, setId) as {
      job: string
      slot_index: number
      status: string
      source: string
      item_id: number | null
    }[]
    const linkRows = db.prepare('SELECT job, slot_index, group_id FROM slot_links WHERE user_id = ? AND set_id = ?').all(userId, setId) as {
      job: string
      slot_index: number
      group_id: number
    }[]

    const slots: Record<string, Record<number, string>> = {}
    const sources: Record<string, Record<number, string>> = {}
    const items: Record<string, Record<number, number>> = {}
    for (const { job, slot_index, status, source, item_id } of slotRows) {
      ;(slots[job] ??= {})[slot_index] = status
      ;(sources[job] ??= {})[slot_index] = source
      if (item_id !== null) (items[job] ??= {})[slot_index] = item_id
    }
    const links: Record<string, Record<number, number>> = {}
    for (const { job, slot_index, group_id } of linkRows) (links[job] ??= {})[slot_index] = group_id

    return c.json({ slots, sources, items, links })
  })

  // Writes to every job linked with :job on this slot, so linked slots can't drift apart
  // Digits only, so it doesn't swallow PUT /:job/links below
  routes.put('/:job/:slot{[0-9]+}', async (c) => {
    const scope = scopeOf(c)
    const job = c.req.param('job')
    const slot = Number(c.req.param('slot'))
    const { status } = await c.req.json<{ status?: unknown }>()

    if (!c.get('setJobs').includes(job)) return c.json({ error: 'Invalid job' }, 400)
    if (!isSlot(slot)) return c.json({ error: 'Invalid slot' }, 400)
    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) return c.json({ error: 'Invalid status' }, 400)

    const upsert = db.prepare(UPSERT_SLOT)
    const now = Date.now()
    transaction(() => {
      for (const j of jobsSharingSlot(scope, job, slot)) upsert.run(scope.userId, scope.setId, j, slot, status, sourceOf(status), now)
    })

    return c.body(null, 204)
  })

  // Pins the slot's piece to one item ({ itemId }), or back to the automatic one ({ itemId: null }). Linked jobs follow.
  routes.put('/:job/:slot{[0-9]+}/item', async (c) => {
    const scope = scopeOf(c)
    const job = c.req.param('job')
    const slot = Number(c.req.param('slot'))
    const { itemId } = await c.req.json<{ itemId?: unknown }>()

    if (!c.get('setJobs').includes(job)) return c.json({ error: 'Invalid job' }, 400)
    if (!isSlot(slot)) return c.json({ error: 'Invalid slot' }, 400)
    if (!isItemId(itemId)) return c.json({ error: 'Invalid item' }, 400)

    const upsert = db.prepare(UPSERT_ITEM)
    const now = Date.now()
    transaction(() => {
      for (const j of jobsSharingSlot(scope, job, slot)) upsert.run(scope.userId, scope.setId, j, slot, itemId, now)
    })
    return c.body(null, 204)
  })

  // Sets several of :job's slots at once (an imported BiS set): { statuses: { [slotIndex]: status }, items?: { [slotIndex]: itemId | null } }.
  // Same rules as the single-slot PUTs, linked jobs included, in one transaction so an import is all or nothing.
  routes.put('/:job', async (c) => {
    const scope = scopeOf(c)
    const job = c.req.param('job')
    const { statuses, items = {} } = await c.req.json<{ statuses?: unknown; items?: unknown }>()

    if (!c.get('setJobs').includes(job)) return c.json({ error: 'Invalid job' }, 400)
    if (typeof statuses !== 'object' || statuses === null) return c.json({ error: 'Invalid statuses' }, 400)
    if (typeof items !== 'object' || items === null) return c.json({ error: 'Invalid items' }, 400)
    const statusEntries = Object.entries(statuses as Record<string, unknown>).map(([slot, status]) => [Number(slot), status] as const)
    for (const [slot, status] of statusEntries) {
      if (!isSlot(slot)) return c.json({ error: 'Invalid slot' }, 400)
      if (typeof status !== 'string' || !VALID_STATUSES.has(status)) return c.json({ error: 'Invalid status' }, 400)
    }
    const itemEntries = Object.entries(items as Record<string, unknown>).map(([slot, id]) => [Number(slot), id] as const)
    for (const [slot, id] of itemEntries) {
      if (!isSlot(slot)) return c.json({ error: 'Invalid slot' }, 400)
      if (!isItemId(id)) return c.json({ error: 'Invalid item' }, 400)
    }

    const upsertSlot = db.prepare(UPSERT_SLOT)
    const upsertItem = db.prepare(UPSERT_ITEM)
    const now = Date.now()
    transaction(() => {
      for (const [slot, status] of statusEntries as [number, string][]) {
        for (const j of jobsSharingSlot(scope, job, slot)) upsertSlot.run(scope.userId, scope.setId, j, slot, status, sourceOf(status), now)
      }
      for (const [slot, id] of itemEntries as [number, number | null][]) {
        for (const j of jobsSharingSlot(scope, job, slot)) upsertItem.run(scope.userId, scope.setId, j, slot, id, now)
      }
    })
    return c.body(null, 204)
  })

  // Replaces which slots :job shares with each job in the body: { links: { [otherJob]: slotIndexes } }.
  // Jobs left out are untouched. Newly linked slots take on :job's statuses (and leave any other link);
  // unlinked slots keep their current statuses. One transaction, so the dialog's Apply is all or nothing.
  routes.put('/:job/links', async (c) => {
    const scope = scopeOf(c)
    const setJobs = c.get('setJobs')
    const source = c.req.param('job')
    const { links } = await c.req.json<{ links?: unknown }>()

    if (!setJobs.includes(source)) return c.json({ error: 'Invalid job' }, 400)
    if (typeof links !== 'object' || links === null) return c.json({ error: 'Invalid links' }, 400)

    const wanted = Object.entries(links as Record<string, unknown>)
    for (const [target, slots] of wanted) {
      if (!setJobs.includes(target)) return c.json({ error: `Invalid job ${target}` }, 400)
      const shareable = sharedSlots(source, target)
      if (!Array.isArray(slots) || !slots.every((s) => shareable.includes(s))) {
        return c.json({ error: `${source} and ${target} can't share those slots` }, 400)
      }
    }

    transaction(() => {
      for (const [target, slots] of wanted as [string, number[]][]) {
        for (const slot of sharedSlots(source, target)) {
          const groupId = groupOf(scope, source, slot)
          const linked = groupId !== undefined && groupOf(scope, target, slot) === groupId
          if (slots.includes(slot) && !linked) linkSlot(scope, source, target, slot)
          else if (!slots.includes(slot) && linked) unlinkSlot(scope, target, slot)
        }
      }
    })
    return c.body(null, 204)
  })

  return routes
}

// The default gear set: every job, set id 0
export const bis = new Hono<BisEnv>()
bis.use(requireAuth)
bis.use(async (c, next) => {
  c.set('setId', 0)
  c.set('setJobs', allJobs)
  await next()
})
bis.route('/', bisRoutes())
