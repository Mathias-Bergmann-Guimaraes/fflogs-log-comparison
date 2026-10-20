/// <reference types="vite/client" />

// Optional: without them the app still runs, but the FF Logs log comparison is disabled (see src/api/auth.ts)
interface ImportMetaEnv {
  readonly VITE_FFLOGS_CLIENT_ID?: string
  readonly VITE_FFLOGS_CLIENT_SECRET?: string
}

declare module '*.graphql?raw' {
  const content: string
  export default content
}
