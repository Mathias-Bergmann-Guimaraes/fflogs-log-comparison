// Shared by the admin server (server/admin.ts) and the admin page (src/admin/). Type-only, so the server can import it.

export type AdminUser = {
  id: number
  username: string
  createdAt: number
  hasPassword: boolean
  // Linked social logins (only Google so far)
  oauth: { provider: string; email: string | null }[]
  // Unexpired sessions, i.e. devices still logged in
  sessions: number
  // When the newest of those sessions was started; null once they've all expired or been revoked
  lastLoginAt: number | null
  features: string[]
}

export type AdminOverview = {
  // Every feature that can be switched on per user (FEATURES in server/features.ts)
  features: string[]
  users: AdminUser[]
}
