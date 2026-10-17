import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { db } from './db.ts'
import { startSession } from './auth.ts'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// Public origin the browser sees; in dev that's Vite, which proxies /api to us
const APP_URL = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`

const FLOW_COOKIE = 'google_oauth'
const FLOW_COOKIE_PATH = '/api/auth/google'

export const googleEnabled = Boolean(CLIENT_ID && CLIENT_SECRET)

type GoogleClaims = { iss: string; aud: string; exp: number; sub: string; email?: string; name?: string; given_name?: string }

const base64url = (buf: Buffer) => buf.toString('base64url')

// Only same-app paths, never an external URL
function safeRedirect(target: string | undefined) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}

// Codes, not messages, so a crafted link can't put arbitrary text on the login page (see LoginView.vue)
function loginError(code: 'google_cancelled' | 'google_expired' | 'google_failed') {
  return `/login?error=${code}`
}

// The ID token comes straight from Google's token endpoint over TLS, so per OpenID Connect
// its signature doesn't need checking; the claims still do.
function readIdToken(idToken: string): GoogleClaims {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Malformed ID token')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GoogleClaims

  if (claims.aud !== CLIENT_ID) throw new Error('ID token audience mismatch')
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') throw new Error('ID token issuer mismatch')
  if (claims.exp * 1000 < Date.now()) throw new Error('ID token expired')
  return claims
}

// 'Mathias Guimarães' -> 'mathiasguimaraes', then 'mathiasguimaraes-2' etc. if taken
function uniqueUsername(claims: GoogleClaims) {
  const source = claims.given_name ?? claims.name ?? claims.email?.split('@')[0] ?? 'user'
  let base = source
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w.-]/g, '')
    .slice(0, 28)
  if (base.length < 3) base = `user${base}`

  const taken = db.prepare('SELECT 1 FROM users WHERE username = ?')
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (!taken.get(candidate)) return candidate
  }
}

function findOrCreateUser(claims: GoogleClaims): number {
  const linked = db.prepare("SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = ?").get(claims.sub) as
    | { user_id: number }
    | undefined
  if (linked) return linked.user_id

  // Deliberately no matching on email to existing password accounts: usernames don't prove email ownership
  db.exec('BEGIN')
  try {
    const now = Date.now()
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, NULL, ?)')
      .run(uniqueUsername(claims), now)
    const userId = Number(lastInsertRowid)
    db.prepare("INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email, created_at) VALUES ('google', ?, ?, ?, ?)").run(
      claims.sub,
      userId,
      claims.email ?? null,
      now,
    )
    db.exec('COMMIT')
    return userId
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export const google = new Hono()

google.use(async (c, next) => {
  if (!googleEnabled) return c.json({ error: 'Google login is not configured' }, 404)
  await next()
})

// Step 1: send the browser to Google, remembering state + PKCE verifier in a short-lived cookie
google.get('/', (c) => {
  const state = base64url(randomBytes(16))
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())

  setCookie(c, FLOW_COOKIE, JSON.stringify({ state, verifier, redirect: safeRedirect(c.req.query('redirect')) }), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: FLOW_COOKIE_PATH,
    maxAge: 10 * 60,
  })

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return c.redirect(url.toString())
})

// Step 2: Google sends the browser back here with ?code&state
google.get('/callback', async (c) => {
  const raw = getCookie(c, FLOW_COOKIE)
  deleteCookie(c, FLOW_COOKIE, { path: FLOW_COOKIE_PATH })

  if (c.req.query('error')) return c.redirect(loginError('google_cancelled'))

  let flow: { state: string; verifier: string; redirect: string }
  try {
    flow = JSON.parse(raw ?? '')
  } catch {
    return c.redirect(loginError('google_expired'))
  }

  const code = c.req.query('code')
  if (!code || c.req.query('state') !== flow.state) return c.redirect(loginError('google_failed'))

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: flow.verifier,
      }),
    })
    if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`)
    const { id_token } = (await res.json()) as { id_token?: string }
    if (!id_token) throw new Error('No ID token in response')

    startSession(c, findOrCreateUser(readIdToken(id_token)))
    return c.redirect(safeRedirect(flow.redirect))
  } catch (err) {
    console.error('Google login error:', err)
    return c.redirect(loginError('google_failed'))
  }
})
