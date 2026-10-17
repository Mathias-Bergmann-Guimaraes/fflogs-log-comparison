import { Hono } from 'hono'
import { db, transaction } from './db.ts'
import { type AuthEnv, requireAuth } from './auth.ts'
import { SLOT_COUNT, allJobs, sharedSlots } from '../src/constants/gearSharing.ts'

// Kept in sync by hand with EquipmentStatus in src/types/EquipmentType.ts
const VALID_STATUSES = new Set(['raid', 'tome', 'twine', 'glaze', 'acquired'])

const isJob = (job: unknown): job is string => typeof job === 'string' && allJobs.includes(job)
const isSlot = (slot: unknown): slot is number => Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < SLOT_COUNT

function groupOf(userId: number, job: string, slot: number): number | undefined {
  const row = db.prepare('SELECT group_id FROM slot_links WHERE user_id = ? AND job = ? AND slot_index = ?').get(userId, job, slot) as
    | { group_id: number }
    | undefined
  return row?.group_id
}

// The job itself plus every job linked to it on this slot
function jobsSharingSlot(userId: number, job: string, slot: number): string[] {
  const groupId = groupOf(userId, job, slot)
  if (groupId === undefined) return [job]
  const rows = db.prepare('SELECT job FROM slot_links WHERE user_id = ? AND slot_index = ? AND group_id = ?').all(userId, slot, groupId) as {
    job: string
  }[]
  return rows.map((r) => r.job)
}

// Removes the job's slot from its group; a group left with one member is dissolved
function unlinkSlot(userId: number, job: string, slot: number) {
  const groupId = groupOf(userId, job, slot)
  if (groupId === undefined) return
  db.prepare('DELETE FROM slot_links WHERE user_id = ? AND job = ? AND slot_index = ?').run(userId, job, slot)
  db.prepare(
    `DELETE FROM slot_links WHERE user_id = ? AND slot_index = ? AND group_id = ?
     AND (SELECT COUNT(*) FROM slot_links WHERE user_id = ? AND slot_index = ? AND group_id = ?) = 1`,
  ).run(userId, slot, groupId, userId, slot, groupId)
}

// target's slot joins source's slot group and takes on source's status
function linkSlot(userId: number, source: string, target: string, slot: number) {
  let groupId = groupOf(userId, source, slot)
  if (groupId !== undefined && groupOf(userId, target, slot) === groupId) return

  unlinkSlot(userId, target, slot)
  const insert = db.prepare('INSERT INTO slot_links (user_id, job, slot_index, group_id) VALUES (?, ?, ?, ?)')
  if (groupId === undefined) {
    const { next } = db
      .prepare('SELECT COALESCE(MAX(group_id), 0) + 1 AS next FROM slot_links WHERE user_id = ? AND slot_index = ?')
      .get(userId, slot) as { next: number }
    groupId = next
    insert.run(userId, source, slot, groupId)
  }
  insert.run(userId, target, slot, groupId)

  db.prepare('DELETE FROM bis_slots WHERE user_id = ? AND job = ? AND slot_index = ?').run(userId, target, slot)
  db.prepare(
    `INSERT INTO bis_slots (user_id, job, slot_index, status, updated_at)
     SELECT user_id, ?, slot_index, status, ? FROM bis_slots WHERE user_id = ? AND job = ? AND slot_index = ?`,
  ).run(target, Date.now(), userId, source, slot)
}

export const bis = new Hono<AuthEnv>()
bis.use(requireAuth)

// slots: only what the user has changed, { [job]: { [slotIndex]: status } }
// links: linked slots only, { [job]: { [slotIndex]: groupId } }; same slot + same id = shared
bis.get('/', (c) => {
  const userId = c.get('user').id
  const slotRows = db.prepare('SELECT job, slot_index, status FROM bis_slots WHERE user_id = ?').all(userId) as {
    job: string
    slot_index: number
    status: string
  }[]
  const linkRows = db.prepare('SELECT job, slot_index, group_id FROM slot_links WHERE user_id = ?').all(userId) as {
    job: string
    slot_index: number
    group_id: number
  }[]

  const slots: Record<string, Record<number, string>> = {}
  for (const { job, slot_index, status } of slotRows) (slots[job] ??= {})[slot_index] = status
  const links: Record<string, Record<number, number>> = {}
  for (const { job, slot_index, group_id } of linkRows) (links[job] ??= {})[slot_index] = group_id

  return c.json({ slots, links })
})

// Writes to every job linked with :job on this slot, so linked slots can't drift apart
// Digits only, so it doesn't swallow PUT /:job/links below
bis.put('/:job/:slot{[0-9]+}', async (c) => {
  const userId = c.get('user').id
  const job = c.req.param('job')
  const slot = Number(c.req.param('slot'))
  const { status } = await c.req.json<{ status?: unknown }>()

  if (!isJob(job)) return c.json({ error: 'Invalid job' }, 400)
  if (!isSlot(slot)) return c.json({ error: 'Invalid slot' }, 400)
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) return c.json({ error: 'Invalid status' }, 400)

  const upsert = db.prepare(
    `INSERT INTO bis_slots (user_id, job, slot_index, status, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, job, slot_index) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
  )
  const now = Date.now()
  transaction(() => {
    for (const j of jobsSharingSlot(userId, job, slot)) upsert.run(userId, j, slot, status, now)
  })

  return c.body(null, 204)
})

// Replaces which slots :job shares with each job in the body: { links: { [otherJob]: slotIndexes } }.
// Jobs left out are untouched. Newly linked slots take on :job's statuses (and leave any other link);
// unlinked slots keep their current statuses. One transaction, so the dialog's Apply is all or nothing.
bis.put('/:job/links', async (c) => {
  const userId = c.get('user').id
  const source = c.req.param('job')
  const { links } = await c.req.json<{ links?: unknown }>()

  if (!isJob(source)) return c.json({ error: 'Invalid job' }, 400)
  if (typeof links !== 'object' || links === null) return c.json({ error: 'Invalid links' }, 400)

  const wanted = Object.entries(links as Record<string, unknown>)
  for (const [target, slots] of wanted) {
    if (!isJob(target)) return c.json({ error: `Invalid job ${target}` }, 400)
    const shareable = sharedSlots(source, target)
    if (!Array.isArray(slots) || !slots.every((s) => shareable.includes(s))) {
      return c.json({ error: `${source} and ${target} can't share those slots` }, 400)
    }
  }

  transaction(() => {
    for (const [target, slots] of wanted as [string, number[]][]) {
      for (const slot of sharedSlots(source, target)) {
        const groupId = groupOf(userId, source, slot)
        const linked = groupId !== undefined && groupOf(userId, target, slot) === groupId
        if (slots.includes(slot) && !linked) linkSlot(userId, source, target, slot)
        else if (!slots.includes(slot) && linked) unlinkSlot(userId, target, slot)
      }
    }
  })
  return c.body(null, 204)
})
