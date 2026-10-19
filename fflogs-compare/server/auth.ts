import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { db } from './db.ts'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

const SESSION_COOKIE = 'session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type User = { id: number; username: string }
export type AuthEnv = { Variables: { user: User } }

// Stored as "salt:hash", both hex
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function startSession(c: Context, userId: number) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expiresAt)

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  })
}

export function endSession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function currentUser(c: Context): User | null {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null

  const row = db
    .prepare(
      `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), Date.now()) as User | undefined
  return row ?? null
}

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = currentUser(c)
  if (!user) return c.json({ error: 'Not logged in' }, 401)
  c.set('user', user)
  await next()
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}
