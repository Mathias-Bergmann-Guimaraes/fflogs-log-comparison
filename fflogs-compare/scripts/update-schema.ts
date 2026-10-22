// Introspects the live FF Logs v2 API and overwrites schema.graphql, the snapshot codegen.ts reads.
// Needs VITE_FFLOGS_CLIENT_ID / VITE_FFLOGS_CLIENT_SECRET in .env. Run when FF Logs changes the schema: npm run schema:update
import { writeFile } from 'node:fs/promises'
import { buildClientSchema, getIntrospectionQuery, printSchema, type IntrospectionQuery } from 'graphql'

const clientId = process.env.VITE_FFLOGS_CLIENT_ID
const clientSecret = process.env.VITE_FFLOGS_CLIENT_SECRET

if (!clientId || !clientSecret) {
  throw new Error('VITE_FFLOGS_CLIENT_ID and VITE_FFLOGS_CLIENT_SECRET must be set in .env')
}

const tokenRes = await fetch('https://www.fflogs.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }),
})
if (!tokenRes.ok) throw new Error(`FF Logs token request failed: ${tokenRes.status}`)
const { access_token } = (await tokenRes.json()) as { access_token: string }

const res = await fetch('https://www.fflogs.com/api/v2/client', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
  body: JSON.stringify({ query: getIntrospectionQuery() }),
})
if (!res.ok) throw new Error(`FF Logs introspection failed: ${res.status}`)
const json = (await res.json()) as { data: IntrospectionQuery }

const header = [
  '# Snapshot of the FF Logs v2 GraphQL schema, used by codegen.ts so codegen works offline and without credentials.',
  '# Refresh it from the live API with `npm run schema:update` (needs FF Logs credentials in .env).',
]
await writeFile('schema.graphql', `${header.join('\n')}\n\n${printSchema(buildClientSchema(json.data))}\n`)
console.log('Wrote schema.graphql')
