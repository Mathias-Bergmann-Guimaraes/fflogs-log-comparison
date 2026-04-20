import type { CodegenConfig } from '@graphql-codegen/cli'

// codegen.ts runs in Node via jiti — process.env is populated by `--env-file=.env` in the npm script.
// The token is fetched here at config-parse time so codegen can introspect the live FFLogs schema.
async function getToken(): Promise<string> {
  const clientId = process.env.VITE_FFLOGS_CLIENT_ID
  const clientSecret = process.env.VITE_FFLOGS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('VITE_FFLOGS_CLIENT_ID and VITE_FFLOGS_CLIENT_SECRET must be set in .env')
  }

  const res = await fetch('https://www.fflogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const data = await res.json() as { access_token: string }
  return data.access_token
}

const token = await getToken()

const config: CodegenConfig = {
  schema: {
    'https://www.fflogs.com/api/v2/client': {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  },
  // Scans all .graphql files under src/ and generates types for each operation found
  documents: 'src/**/*.graphql',
  generates: {
    'src/api/__generated__/graphql.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        avoidOptionals: true,
        strictScalars: true,
        // maybeValue: 'T' strips nullability from generated types — valid because the query
        // layer already throws on errors, so null fields in a successful response won't occur
        maybeValue: 'T',
        scalars: {
          Float: 'number',
          Int: 'number',
          String: 'string',
          Boolean: 'boolean',
          ID: 'string',
          JSON: 'unknown',
        },
      },
    },
  },
}

export default config
