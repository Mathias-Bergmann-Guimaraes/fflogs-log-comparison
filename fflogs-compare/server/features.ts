import type { MiddlewareHandler } from 'hono'
import { db } from './db.ts'
import type { AuthEnv } from './auth.ts'

// Features only some accounts get. Nobody has one until it's switched on for them on the admin page (server/admin.ts).
export const FEATURES = ['hunts'] as const
export type Feature = (typeof FEATURES)[number]

export const isFeature = (value: unknown): value is Feature => FEATURES.includes(value as Feature)

export function userFeatures(userId: number): Feature[] {
  const rows = db.prepare('SELECT feature FROM user_features WHERE user_id = ?').all(userId) as { feature: string }[]
  // Names dropped from FEATURES can still have rows; they mean nothing anymore
  return rows.map((r) => r.feature).filter(isFeature)
}

export function setFeature(userId: number, feature: Feature, enabled: boolean) {
  if (enabled) {
    db.prepare('INSERT OR IGNORE INTO user_features (user_id, feature, enabled_at) VALUES (?, ?, ?)').run(userId, feature, Date.now())
  } else {
    db.prepare('DELETE FROM user_features WHERE user_id = ? AND feature = ?').run(userId, feature)
  }
}

// Goes after requireAuth. Answers 404 rather than 403, so the feature looks like it doesn't exist to everyone else.
export const requireFeature =
  (feature: Feature): MiddlewareHandler<AuthEnv> =>
  async (c, next) => {
    const exists = db.prepare('SELECT 1 FROM user_features WHERE user_id = ? AND feature = ?').get(c.get('user').id, feature)
    if (!exists) return c.json({ error: 'Not found' }, 404)
    await next()
  }
