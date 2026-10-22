import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  // Reads the committed schema snapshot, so codegen needs no credentials or network.
  // Refresh the snapshot from the live API with `npm run schema:update`.
  schema: 'schema.graphql',
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
