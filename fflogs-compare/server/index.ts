import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { db } from './db.ts'
import { type AuthEnv, currentUser, endSession, hashPassword, purgeExpiredSessions, startSession, verifyPassword } from './auth.ts'
import { google, googleEnabled } from './google.ts'
import { bis } from './bis.ts'

const PORT = Number(process.env.PORT ?? 3000)

const USERNAME_RE = /^[\w.-]{3,32}$/

const api = new Hono<AuthEnv>()

// Rejects cross-site form posts; the session cookie is SameSite=Lax as a second layer
api.use(csrf())

// --- Auth ---

type Credentials = { username?: unknown; password?: unknown }

function parseCredentials(body: Credentials) {
  const { username, password } = body
  if (typeof username !== 'string' || typeof password !== 'string') return null
  return { username: username.trim(), password }
}

api.post('/auth/register', async (c) => {
  const creds = parseCredentials(await c.req.json<Credentials>())
  if (!creds || !USERNAME_RE.test(creds.username)) {
    return c.json({ error: 'Username must be 3-32 letters, numbers, dots, dashes or underscores' }, 400)
  }
  if (creds.password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(creds.username)
  if (existing) return c.json({ error: 'Username is taken' }, 409)

  const hash = await hashPassword(creds.password)
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(creds.username, hash, Date.now())

  startSession(c, Number(lastInsertRowid))
  return c.json({ id: Number(lastInsertRowid), username: creds.username }, 201)
})

api.post('/auth/login', async (c) => {
  const creds = parseCredentials(await c.req.json<Credentials>())
  if (!creds) return c.json({ error: 'Username and password are required' }, 400)

  const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(creds.username) as
    | { id: number; username: string; password_hash: string | null }
    | undefined
  // Google-only accounts have no password, so they can't log in this way
  if (!row?.password_hash || !(await verifyPassword(creds.password, row.password_hash))) {
    return c.json({ error: 'Wrong username or password' }, 401)
  }

  startSession(c, row.id)
  return c.json({ id: row.id, username: row.username })
})

api.post('/auth/logout', (c) => {
  endSession(c)
  return c.body(null, 204)
})

// Lets the login page hide buttons for providers that aren't configured
api.get('/auth/providers', (c) => c.json({ google: googleEnabled }))

api.route('/auth/google', google)

api.get('/auth/me', (c) => {
  const user = currentUser(c)
  return user ? c.json(user) : c.json({ error: 'Not logged in' }, 401)
})

api.route('/bis', bis)

// --- App ---

const app = new Hono()
app.route('/api', api)
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

// In production the same process serves the built SPA; in dev Vite does that and proxies /api here
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('/*', serveStatic({ path: './dist/index.html' }))
}

purgeExpiredSessions()
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref()

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
