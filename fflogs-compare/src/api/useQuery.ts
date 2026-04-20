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
  ReportFightEventsQuery,
  ReportFightEventsQueryVariables,
  ReportPlayerSummaryQuery,
  ReportPlayerSummaryQueryVariables
} from '@/api/__generated__/graphql'

import rateLimitDataGql from '@/api/queries/rateLimitData.graphql?raw'
import reportMetaGql from '@/api/queries/reportMeta.graphql?raw'
import reportPlayersGql from '@/api/queries/reportPlayers.graphql?raw'
import reportFightEvents from '@/api/queries/reportFightEvents.graphql?raw'
import reportPlayerSummary from '@/api/queries/reportPlayerSummary.graphql?raw'

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
export function fetchReportFightEvents(token: string, variables: ReportFightEventsQueryVariables) {
  return query<ReportFightEventsQuery, ReportFightEventsQueryVariables>(token, reportFightEvents, variables)
}

// fetchReportData returns paginated damage events — use fetchAllEvents in the store to collect all pages
export function fetchReportPlayerSummary(token: string, variables: ReportPlayerSummaryQueryVariables) {
  return query<ReportPlayerSummaryQuery, ReportPlayerSummaryQueryVariables>(token, reportPlayerSummary, variables)
}

