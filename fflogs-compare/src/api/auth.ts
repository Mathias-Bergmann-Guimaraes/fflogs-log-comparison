// Uses the OAuth 2.0 client credentials flow — no user login involved.
// The token is short-lived and scoped to public data only.
// Credentials come from VITE_FFLOGS_CLIENT_ID / VITE_FFLOGS_CLIENT_SECRET in .env.
const CLIENT_ID = import.meta.env.VITE_FFLOGS_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_FFLOGS_CLIENT_SECRET

// The credentials are optional: without them the rest of the app works, and FF Logs views show this message instead
export const hasFFLogsCredentials = Boolean(CLIENT_ID && CLIENT_SECRET)
export const MISSING_CREDENTIALS_MESSAGE =
  'FF Logs API credentials not configured — add VITE_FFLOGS_CLIENT_ID / VITE_FFLOGS_CLIENT_SECRET to .env and restart the dev server.'

export async function getToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error(MISSING_CREDENTIALS_MESSAGE)

  const res = await fetch('https://www.fflogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  return data.access_token
}
