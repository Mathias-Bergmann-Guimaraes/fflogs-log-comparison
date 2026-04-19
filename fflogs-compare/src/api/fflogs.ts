const API_URL = 'https://www.fflogs.com/api/v2/client'

export async function query<T = unknown>(
  token: string,
  gql: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: gql, variables }),
  })

  if (!res.ok) throw new Error('FF Logs API request failed')

  const json = await res.json()

  if (json.errors) throw new Error(json.errors[0].message)

  return json.data
}
