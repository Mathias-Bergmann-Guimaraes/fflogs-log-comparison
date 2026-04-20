// Each function here ties a raw .graphql query string to its codegen-generated types.
// The ?raw Vite suffix imports the file as a plain string at build time — no GraphQL client needed.
// To add a new query: create a .graphql file, run `npm run codegen`, then add a typed wrapper here.

import { query } from '@/api/fflogs'
import type {
  RateLimitDataQuery,
  ReportMetaQuery,
  ReportMetaQueryVariables,
  ReportPlayersQuery,
  ReportPlayersQueryVariables,
  ReportDataQuery,
  ReportDataQueryVariables,
} from '@/api/__generated__/graphql'
import rateLimitDataGql from '@/api/queries/rateLimitData.graphql?raw'
import reportMetaGql from '@/api/queries/reportMeta.graphql?raw'
import reportPlayersGql from '@/api/queries/reportPlayers.graphql?raw'
import reportDataGql from '@/api/queries/reportData.graphql?raw'

export function fetchRateLimitData(token: string) {
  return query<RateLimitDataQuery>(token, rateLimitDataGql)
}

export function fetchReportMeta(token: string, variables: ReportMetaQueryVariables) {
  return query<ReportMetaQuery, ReportMetaQueryVariables>(token, reportMetaGql, variables)
}

export function fetchReportPlayers(token: string, variables: ReportPlayersQueryVariables) {
  return query<ReportPlayersQuery, ReportPlayersQueryVariables>(token, reportPlayersGql, variables)
}

// fetchReportData returns paginated damage events — use fetchAllEvents in the store to collect all pages
export function fetchReportData(token: string, variables: ReportDataQueryVariables) {
  return query<ReportDataQuery, ReportDataQueryVariables>(token, reportDataGql, variables)
}
