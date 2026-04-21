import { WorldData, Encounter, EncounterCharacterRankingsArgs } from './../api/__generated__/graphql';
import { RankingEntry } from './../types/fflogs';
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToken } from '@/api/auth'
import  *  as ql from '@/api/useQuery'
import type { Actor, ReportMeta, ReportPlayers, RateLimitData, ReportFightEvents, ReportPlayerSummary, TableData, PlayerSummary, TableEntry, CharacterRankings, TopPlayerDto, TopPlayerReport } from '@/types/fflogs'
import { toNum } from '../types/typesUtils'

export const useFFLogsStore = defineStore('fflogs', () => {
  // Cached OAuth token — fetched once on first API call, reused for all subsequent calls
  const token = ref<string | null>(null)

  // Keyed by report code to avoid re-fetching the same report across navigations
  const reports = ref<Record<string, ReportMeta>>({})
  const reportPlayers = ref<Record<string, ReportPlayers>>({})
  const fightEvents = ref<Record<string, ReportFightEvents>>({})
  const topPlayers = ref<Record<string, TopPlayerDto[]>>({})
  const topPlayersReport = ref<>()
  const playerSummary = ref<Record<string, ReportPlayerSummary>>({})
  const playerSmallSummary = ref<Record<string, PlayerSummary>>({})

  // Players who participated in the selected fights, with LimitBreak filtered out
  const lastReportPlayers = ref<Actor[]>([])
  const maxPlayerToCompare = ref<number>(10)

  const loading = ref(false)
  const error = ref<string | null>(null)

  // FFLogs rate limit state — useful for showing the user how many API points remain
  const quota = ref<RateLimitData | null>(null)

  // Lazily fetches and caches the OAuth token using client credentials from .env
  async function ensureToken() {
    if (!token.value) {
      token.value = await getToken()
    }
  }

  // MARK: Querries

  // FFLogs paginates events via nextPageTimestamp — this loops until all pages are collected.
  // startTime advances each iteration to the timestamp where the previous page ended.
  async function fetchAllEvents(code: string, fightIDs: number[] = [], startTime: number | undefined, endTime: number | undefined) {
    const allEvents: unknown[] = []
    if(!startTime || !endTime){
      error.value = "startTime or EndTime is invalid"
      console.error({startTime: startTime, endTime: endTime})
      return
    }

    const data = await ql.fetchReportFightEvents(token.value!, { code, fightIDs, startTime, endTime })
    return data
  }

  /**
   * Fetches sumary data of a Single Player like rDPS, aDPS, nDPS, cDPS
   */
  async function fetchPlayerSumary(code: string, fightIDs: number[], playerID: number) {
    if (!reports.value[code]){
      fetchReport(code, fightIDs)
    }

    const fightStartTime = reports.value[code]?.fights[0]?.startTime
    const fightEndTime = reports.value[code]?.fights[0]?.endTime

    if (!fightEndTime || !fightStartTime){
      return
    }

    const [rateLimitData, data] = await Promise.all([
      ql.fetchRateLimitData(token.value!),
      ql.fetchReportPlayerSummary(token.value!, { code, fightIDs, startTime: fightStartTime, endTime: fightEndTime, sourceID: playerID })
    ])

    quota.value = rateLimitData.rateLimitData
    const tableData = (data.reportData.report.table as { data: TableData }).data
    playerSummary.value[code] = tableData
    return tableData
  }

  // Fetches title, startTime, endTime, and the full fights list for a report.
  // Rate limit and report data are fetched in parallel to save a round-trip.
  async function fetchReport(code: string, fightIDs: number[] | undefined) {
    if (reports.value[code]) return  // already cached
    if (!fightIDs){
      error.value = "invalid fight"
      return
    }

    loading.value = true
    error.value = null

    try {
      await ensureToken()

      const [rateLimitData, reportData] = await Promise.all([
        ql.fetchRateLimitData(token.value!),
        ql.fetchReportMeta(token.value!, { code, fightIDs}),
      ])

      quota.value = rateLimitData.rateLimitData
      reports.value[code] = reportData.reportData.report
      // console.log({repots: reports, actualReport: reports.value[code]})
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  // Fetches all actors in the report and resolves which ones were active in the given fights.
  // fightIDs defaults to [] which the FFLogs API interprets as "all fights".
  async function fetchPlayers(code: string, fightIDs: number[] = []) {
    if (reportPlayers.value[code]) return  // already cached

    loading.value = true
    error.value = null

    try {
      await ensureToken()

      const [rateLimitData, playersData] = await Promise.all([
        ql.fetchRateLimitData(token.value!),
        ql.fetchReportPlayers(token.value!, { code, fightIDs }),
      ])

      quota.value = rateLimitData.rateLimitData

      const report = playersData.reportData.report
      reportPlayers.value[code] = report

      // friendlyPlayers is a flat list of actor IDs per fight — flatten and deduplicate
      const activeIDs = new Set(report.fights.flatMap(f => f.friendlyPlayers))
      lastReportPlayers.value = curatePlayers(report.masterData.actors, activeIDs)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function fetchTopPlayers(job: string, code: string): Promise<TopPlayerDto[]> {
    const encounterID = reports.value[code]?.fights[0]?.encounterID
    if (!encounterID){
      error.value = 'no fight'
      return []
    }
    const data = await ql.fetchTopPlayers(token.value!, { specName: job, encounterID })
    const topRankings = (data.worldData.encounter.characterRankings as { rankings: CharacterRankings }).rankings.rankings.splice(0, maxPlayerToCompare.value)
    const chads = topRankings.map((ranking) => ({
      name: ranking.name,
      spec: ranking.spec,
      report: ranking.report as TopPlayerReport,
    })) as TopPlayerDto[]

    topPlayers.value[`${job}-${encounterID}`] = chads
    return chads
  }

  function curatePlayers(actors: Actor[], activeIDs: Set<number>): Actor[] {
    // Limit Break appears as a player in friendlyPlayers but is not a real player slot
    return actors.filter(a => activeIDs.has(a.id) && a.subType !== 'LimitBreak')
  }

  function curatePlayerSummary(playerID:number, tableData: TableData | undefined){
    if(!tableData){
      error.value = 'no Table Data'
      return
    }
    let totalDamage = 0
    let aDPS = 0
    let rDPS = 0
    let nDPS = 0
    let cDPS = 0
    let totalCrit = 0
    let totalDH = 0
    let totalHit = 0
    let totalHittableActions = 0
    if(tableData.entries){
      tableData.entries.forEach((entry) =>{
        totalDamage += entry.total
        rDPS += toNum(entry.totalRDPS)
        aDPS += toNum(entry.totalRDPS)
        nDPS += toNum(entry.totalRDPS)
        cDPS += toNum(entry.totalRDPS)

      if(entry.hitCount){
        const cominedTotalHit = entry.hitCount + entry.multistrikeHitCount
        totalCrit += entry.critHitCount/cominedTotalHit
        totalDH += entry.multistrikeHitCount/cominedTotalHit

        totalHittableActions++
        }
      })
      totalHit += totalDH
    }

    playerSmallSummary.value[playerID] = {
      totalDamage,
      rDPS: calcDPS(rDPS, tableData) * 1000,
      aDPS: calcDPS(aDPS, tableData) * 1000,
      nDPS: calcDPS(nDPS, tableData) * 1000,
      cDPS: calcDPS(cDPS, tableData) * 1000,
      crit: totalCrit/totalHittableActions,
      directHit: totalDH/totalHittableActions
    }
  }

  function calcDPS(total: number, tableData: TableData): number {
    if(!tableData.damageDowntime){
      return total/tableData.combatTime
    }
    const activeTime = (tableData.combatTime - tableData.damageDowntime) //idk why /1000 makes no difference here
    return (total / activeTime)
  }

  return {
    token,
    reports,
    loading,
    reportPlayers,
    lastReportPlayers,
    topPlayers,
    playerSmallSummary,
    error,
    quota,
    fetchReport,
    fetchPlayers,
    fetchPlayerSumary,
    curatePlayerSummary,
    fetchAllEvents,
    fetchTopPlayers,
  }
})
