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

export function fetchReportData(token: string, variables: ReportDataQueryVariables) {
  return query<ReportDataQuery, ReportDataQueryVariables>(token, reportDataGql, variables)
}
