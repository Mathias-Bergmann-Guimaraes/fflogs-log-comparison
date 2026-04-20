// FFLogs v2 uses GraphQL over a plain HTTP POST — no GraphQL client library needed.
const API_URL = 'https://www.fflogs.com/api/v2/client'

export async function query<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
  token: string,
  gql: string,
  variables?: TVariables
): Promise<TData> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: gql, variables: variables ?? {} }),
  })

  if (!res.ok) throw new Error('FF Logs API request failed')

  const json = await res.json()

  // GraphQL always returns HTTP 200 even on errors — actual errors are in the body
  if (json.errors) throw new Error(json.errors[0].message)

  return json.data
}
