import { Hono } from 'hono'
import { db } from './db.ts'
import { type AuthEnv, requireAuth } from './auth.ts'

// Per-user UI settings, stored as opaque JSON: the client validates what it reads back.
// Only these keys are accepted, so this can't become free-form storage.
const KEYS = new Set(['dashboardLayout', 'favoriteJobs', 'huntPingLabels', 'huntAlerts', 'relicWeapons', 'ultimateWeapons', 'profile', 'preferences'])
const MAX_BYTES = 16 * 1024

export const settings = new Hono<AuthEnv>()
settings.use(requireAuth)

// { value: <saved JSON> }, or { value: null } if never saved
settings.get('/:key', (c) => {
  const key = c.req.param('key')
  if (!KEYS.has(key)) return c.json({ error: 'Unknown setting' }, 404)
  const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(c.get('user').id, key) as { value: string } | undefined
  return c.json({ value: row ? JSON.parse(row.value) : null })
})

// Body: { value: <any JSON> }
settings.put('/:key', async (c) => {
  const key = c.req.param('key')
  if (!KEYS.has(key)) return c.json({ error: 'Unknown setting' }, 404)

  const raw = await c.req.text()
  if (raw.length > MAX_BYTES) return c.json({ error: 'Setting is too large' }, 413)
  let body: { value?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!body || typeof body !== 'object' || !('value' in body)) return c.json({ error: 'Missing value' }, 400)

  db.prepare(
    `INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(c.get('user').id, key, JSON.stringify(body.value), Date.now())
  return c.body(null, 204)
})
