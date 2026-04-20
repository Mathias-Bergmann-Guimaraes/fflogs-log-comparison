import type { RateLimitDataQuery, ReportMetaQuery, ReportPlayersQuery, ReportFightEventsQuery } from '@/api/__generated__/graphql'

// Unwrap deeply nested query shapes into flat, reusable types.
// Using index access keeps these in sync with codegen — no manual updates needed.
export type ReportMeta = ReportMetaQuery['reportData']['report']
export type ReportPlayers = ReportPlayersQuery['reportData']['report']
export type Actor = ReportPlayers['masterData']['actors'][number]
export type RateLimitData = RateLimitDataQuery['rateLimitData']
export type ReportFightEvents = ReportFightEventsQuery['reportData']['report']

// Non-GraphQL domain type used for parsing report URLs
export interface ReportURL {
  code: string
  fightIDs: number[]
}
