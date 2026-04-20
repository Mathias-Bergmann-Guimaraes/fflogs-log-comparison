import type { RateLimitDataQuery, ReportMetaQuery, ReportPlayersQuery, ReportFightEventsQuery, ReportPlayerSummaryQuery } from '@/api/__generated__/graphql'

// Unwrap deeply nested query shapes into flat, reusable types.
// Using index access keeps these in sync with codegen — no manual updates needed.
export type ReportMeta = ReportMetaQuery['reportData']['report']
export type ReportPlayers = ReportPlayersQuery['reportData']['report']
export type Actor = ReportPlayers['masterData']['actors'][number]
export type RateLimitData = RateLimitDataQuery['rateLimitData']
export type ReportFightEvents = ReportFightEventsQuery['reportData']['report']
// export type ReportPlayerSummary = ReportPlayerSummaryQuery['reportData']['report']
export type ReportPlayerSummary = TableData


// Non-GraphQL domain type used for parsing report URLs
export interface ReportURL {
  code: string
  fightIDs: number[]
}



export interface reportEvent{
  timestamp: number
  type: 'damage' | 'calculatingdamage'   // calculateddamage = snapshot, damage = when it lands
  packetID: number
  sourceID: number            // actor ID of who dealt it
  targertID: number           // actor ID of who received it
  abilityGameID: number       // the ability used
  fight: number               // fight ID
  hitType: 1 | 2              // 1 = normal, 2 = crit
  amount: number              // actual damage dealt
  unmitigatedAmount: number   // damage before mitigation
  directHit?: boolean         // was it a direct hit
  multiplier: number          // buff multiplier e.g. 1.05 = 5% buff active
  bonusPercent?: number       // direct hit bonus %
  buffs?: string              // dot-separated list of active buff IDs e.g. "1000049.1000851."
  tick?: boolean              // true = DoT tick
}


export interface TableBuff {
  guid: number
  name: string
  total: string | number
  type: string
  abilityIcon: string
}

export interface HitDetail {
  type: 'Hit' | 'Critical Hit'
  total: number
  count: number
  absorbOrOverheal: number
  min: number
  max: number
}

export interface TableEntry {
  name: string
  guid: number
  actor?: number
  actorName?: string
  actorIcon?: string
  actorType?: string
  type: number
  total: number
  abilityIcon: string
  composite?: boolean          // true = grouped ability (e.g. Veraero III has subentries)
  subentries?: TableEntry[]    // composite entries contain the real per-actor data here
  totalRDPS: string | number
  totalADPS: string | number
  totalNDPS: string | number
  totalCDPS: string | number
  totalRDPSGiven: string | number
  totalRDPSTaken: string | number
  given: TableBuff[]
  taken: TableBuff[]
  uses: number
  hitCount: number
  critHitCount: number
  multistrikeHitCount: number
  missCount: number
  tickCount: number
  hitdetails: HitDetail[]
  multistrikedetails: HitDetail[]
  missdetails: HitDetail[]
}

export interface TableData {
  entries: TableEntry[]
  totalTime: number
  combatTime: number
  damageDowntime?: number
  logVersion: number
  gameVersion: number
}

export interface PlayerSummary {
  totalDamage: number
  rDPS: number
  aDPS:number
  nDPS: number
  cDPS: number
  crit: number //crit%
  directHit: number //DH%
}
