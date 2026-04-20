// Uses the OAuth 2.0 client credentials flow — no user login involved.
// The token is short-lived and scoped to public data only.
// Credentials come from VITE_FFLOGS_CLIENT_ID / VITE_FFLOGS_CLIENT_SECRET in .env.
export async function getToken(): Promise<string> {
  const res = await fetch('https://www.fflogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: import.meta.env.VITE_FFLOGS_CLIENT_ID,
      client_secret: import.meta.env.VITE_FFLOGS_CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  return data.access_token
}
