import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { db, transaction } from './db.ts'
import { hashPassword, SESSION_TTL_MS } from './auth.ts'
import { FEATURES, isFeature, setFeature } from './features.ts'
import type { AdminOverview, AdminUser } from '../src/types/admin.ts'

// The admin page: every account, and per-user features. It has no login of its own. What keeps it private is that
// it listens on a separate port bound to loopback, which the reverse proxy doesn't forward, so the only way in is from
// the server itself (e.g. `ssh -L 3001:localhost:3001 server`, then http://localhost:3001).
// Never mount this on the public app instead: behind a proxy every public request comes from 127.0.0.1 too.
const ADMIN_PORT = Number(process.env.ADMIN_PORT ?? 3001)
// Only change this when the server runs in a container (then 0.0.0.0, published to the host as 127.0.0.1:3001:3001)
const ADMIN_HOST = process.env.ADMIN_HOST ?? '127.0.0.1'
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

const admin = new Hono()

// Only requests addressed to localhost. A web page can point its own domain at 127.0.0.1 (DNS rebinding) and reach
// this port through the browser while a tunnel is open; its requests still carry that domain as Host.
admin.use(async (c, next) => {
  const host = c.req.header('host')
  const hostname = host ? URL.parse(`http://${host}`)?.hostname : undefined
  if (!hostname || !LOOPBACK.has(hostname)) return c.text('Forbidden', 403)
  await next()
})
admin.use(csrf())

type UserRow = {
  id: number
  username: string
  created_at: number
  has_password: number
  oauth: string
  sessions: number
  last_expiry: number | null
  features: string
}

const api = new Hono()

api.get('/users', (c) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.created_at, u.password_hash IS NOT NULL AS has_password,
         (SELECT json_group_array(json_object('provider', provider, 'email', email)) FROM oauth_accounts o WHERE o.user_id = u.id) AS oauth,
         (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS sessions,
         (SELECT MAX(expires_at) FROM sessions s WHERE s.user_id = u.id) AS last_expiry,
         (SELECT json_group_array(feature) FROM user_features f WHERE f.user_id = u.id) AS features
       FROM users u ORDER BY u.created_at DESC`,
    )
    .all(Date.now()) as UserRow[]

  const users = rows.map(
    (r): AdminUser => ({
      id: r.id,
      username: r.username,
      createdAt: r.created_at,
      hasPassword: Boolean(r.has_password),
      oauth: JSON.parse(r.oauth),
      sessions: r.sessions,
      // Sessions only store when they expire, and all last SESSION_TTL_MS
      lastLoginAt: r.last_expiry === null ? null : r.last_expiry - SESSION_TTL_MS,
      features: (JSON.parse(r.features) as string[]).filter(isFeature),
    }),
  )
  const overview: AdminOverview = { features: [...FEATURES], users }
  return c.json(overview)
})

function findUser(id: string) {
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(Number(id)) as { id: number; username: string } | undefined
}

// Body: { enabled: boolean }
api.put('/users/:id/features/:feature', async (c) => {
  const user = findUser(c.req.param('id'))
  if (!user) return c.json({ error: 'No such user' }, 404)
  const feature = c.req.param('feature')
  if (!isFeature(feature)) return c.json({ error: 'No such feature' }, 404)
  const { enabled } = await c.req.json<{ enabled?: unknown }>()
  if (typeof enabled !== 'boolean') return c.json({ error: 'enabled must be true or false' }, 400)

  setFeature(user.id, feature, enabled)
  console.log(`Admin: ${feature} ${enabled ? 'enabled' : 'disabled'} for ${user.username}`)
  return c.body(null, 204)
})

// Logs the user out everywhere
api.delete('/users/:id/sessions', (c) => {
  const user = findUser(c.req.param('id'))
  if (!user) return c.json({ error: 'No such user' }, 404)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  console.log(`Admin: logged out ${user.username}`)
  return c.body(null, 204)
})

// Body: { password: string }. Also logs them out everywhere, as anyone who knew the old password might be logged in.
api.put('/users/:id/password', async (c) => {
  const user = findUser(c.req.param('id'))
  if (!user) return c.json({ error: 'No such user' }, 404)
  const { password } = await c.req.json<{ password?: unknown }>()
  if (typeof password !== 'string' || password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  const hash = await hashPassword(password)
  transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  })
  console.log(`Admin: password reset for ${user.username}`)
  return c.body(null, 204)
})

// Everything of theirs goes with it (every table references users ON DELETE CASCADE)
api.delete('/users/:id', (c) => {
  const user = findUser(c.req.param('id'))
  if (!user) return c.json({ error: 'No such user' }, 404)
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
  console.log(`Admin: deleted ${user.username}`)
  return c.body(null, 204)
})

admin.route('/admin-api', api)
admin.all('/admin-api/*', (c) => c.json({ error: 'Not found' }, 404))

// The page is its own build (vite.admin.config.ts) in dist-admin/, so the public server never has it to serve.
// In dev its Vite server (npm run dev:admin) does that and proxies /admin-api here.
if (process.env.NODE_ENV === 'production') {
  admin.use('/*', serveStatic({ root: './dist-admin' }))
  admin.get('/*', serveStatic({ path: './dist-admin/admin.html' }))
}

export function startAdminServer() {
  if (!LOOPBACK.has(ADMIN_HOST)) {
    console.warn(`Admin server bound to ${ADMIN_HOST}: make sure port ${ADMIN_PORT} is not reachable from outside`)
  }
  serve({ fetch: admin.fetch, port: ADMIN_PORT, hostname: ADMIN_HOST }, (info) => {
    console.log(`Admin listening on http://${ADMIN_HOST}:${info.port} (local only)`)
  })
}
