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
