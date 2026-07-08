import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToken } from '@/api/auth'
import * as ql from '@/api/useQuery'
import type {
  Actor,
  ReportMeta,
  ReportPlayers,
  RateLimitData,
  ReportFightEvents,
  ReportPlayerSummary,
  TableData,
  PlayerSummary,
  TableEntry,
  CharacterRankings,
  TopPlayerDto,
  TopPlayerReport,
  ReportPlayersRoles,
  ReportPlayersDetails,
  GraphData,
  ReportEvent,
  AbilityEvent,
} from '@/types/fflogs'
import { toNum } from '../types/typesUtils'
import AbilityList from '@/views/bigPlayerView/abilityList.vue'

export const useFFLogsStore = defineStore('fflogs', () => {
  // Cached OAuth token — fetched once on first API call, reused for all subsequent calls
  const token = ref<string | null>(null)

  // Keyed by report code to avoid re-fetching the same report across navigations
  const reportMetadata = ref<Record<string, ReportMeta>>({})
  const reportPlayers = ref<Record<string, ReportPlayers>>({})
  const fightEvents = ref<Record<string, ReportFightEvents>>({})
  const topPlayers = ref<Record<string, TopPlayerDto[]>>({})
  // const topPlayersReport = ref<>()
  const playerSummary = ref<Record<string, ReportPlayerSummary>>({})
  const playerSmallSummary = ref<Record<string, PlayerSummary>>({})
  const selectedPlayerGraphData = ref<Record<number, number[]>>()
  const selectedPlayerTableData = ref<Record<number, TableData>>()
  const selectedPlayerPhaseCombatTime = ref<Record<number, number>>({})

  // Players who participated in the selected fights, with LimitBreak filtered out
  const lastReportPlayers = ref<Actor[]>([])
  const maxPlayerToCompare = ref<number>(5)

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

  async function getSelectedPlayerTableDataByPhase(code: string, playerID: number) {
    const fightID = reportMetadata.value[code]?.fights[0]?.id ?? 0
    const fightEndTime = reportMetadata.value[code]?.fights[0]?.endTime ?? 0
    const phases = reportMetadata.value[code]?.fights[0]?.phaseTransitions ?? []
    for (let i = 1; i < phases.length + 1; i++) {
      const phase = phases[i - 1]
      if (!phase) return

      const startTime = phases[i - 1]?.startTime ?? 0
      const endTime = i === phases.length ? fightEndTime : (phases[i]?.startTime ?? 0)

      console.log(startTime, endTime)

      const data = await fetchPlayerSumary(code, [fightID], playerID, startTime, endTime)

      if (!data?.damageDowntime && data?.combatTime) {
        selectedPlayerPhaseCombatTime.value[i] = data?.combatTime
      }
      if (data?.combatTime && data?.damageDowntime) selectedPlayerPhaseCombatTime.value[i] = data?.combatTime - data?.damageDowntime

      if (!selectedPlayerTableData.value) {
        selectedPlayerTableData.value = {}
      }
      if (!data) {
        return
      }

      selectedPlayerTableData.value[phase.id] = data
    }
  }

  async function saveSelectedPlayer(code: string, playerID: number) {
    const fightID = reportMetadata.value[code]?.fights[0]?.id ?? 0
    const fightEndTime = reportMetadata.value[code]?.fights[0]?.endTime ?? 0
    const phases = reportMetadata.value[code]?.fights[0]?.phaseTransitions ?? []
    for (let i = 1; i < phases.length + 1; i++) {
      const phase = phases[i - 1]
      if (!phase) return

      const startTime = phases[i - 1]?.startTime ?? 0
      const endTime = i === phases.length ? fightEndTime : (phases[i]?.startTime ?? 0)

      console.log(startTime, endTime)

      const data = await fetchPlayerGraph(code, [fightID], playerID, startTime, endTime)
      const totalGraph = data?.series?.find((graph) => graph.name === 'Total')

      if (!selectedPlayerGraphData.value) {
        selectedPlayerGraphData.value = {}
      }

      selectedPlayerGraphData.value[phase.id] = totalGraph?.data ?? []
    }
    getSelectedPlayerTableDataByPhase(code, playerID)
  }

  // MARK: V2

  function parseAllEvents(allEvents: ReportEvent[]) {
    const eventsByAbility = new Map<number, AbilityEvent>()

    for (const event of allEvents) {
      // all abilities are doubled with damage calculated (snapshot) and damage (actual damage dealt)
      // here we will focus only on damageCalculated
      if (event.type !== 'calculatingdamage') {
        continue
      }

      // checks if the ability is already stored
      const abilityID = event.ability.guid
      const storedAbility = eventsByAbility.get(abilityID)

      if (storedAbility) {
        // check if it is first or second target by checking for how much % ist deviates from the stored damage
        // or if it is closer to either

        if (eventsByAbility.get(abilityID)?.totalOne){
          
        }

        // ===========
        // do stuff
        // ======
        // calculate ratio between {first target, second target} Base and {Crit, DH, cirect Crit}
      } else {
        const normalizedDamage = normalizeDamage(event.amount, event.multiplier)

        // stores ability
        eventsByAbility.set(abilityID, {
          abilityID,
          event: [event],
          count: 1,
          name: event.ability.name,
          // whether to populate crit or base
          ...(event.hitType === 1
            ? { totalOne: normalizedDamage, baseDamageToCritDHRatio: -1 }
            : { totalCritDHOne: normalizedDamage, baseDamageToCritDHRatio: -1 }),
        })
      }
    }
  }

  function normalizeDamage(amount: number, multiplier: number) {
    return amount / multiplier
  }

  function getDamageAverage(totalDamage: number, count: number) {
    return totalDamage / count
  }

  // MARK: Querries

  // FFLogs paginates events via nextPageTimestamp — this loops until all pages are collected.
  // startTime advances each iteration to the timestamp where the previous page ended.
  async function fetchAllEvents(code: string, fightIDs: number[] = [], startTime: number | undefined, endTime: number | undefined) {
    const allEvents: ReportEvent[] = []
    if (!startTime || !endTime) {
      error.value = 'startTime or EndTime is invalid'
      return
    }
    let queryStartTime = startTime

    while (!queryStartTime) {
      const data = await ql.fetchReportFightEvents(token.value!, { code, fightIDs, startTime: queryStartTime, endTime })
      const parsedData = data.reportData.report.events.data as ReportEvent
      allEvents.concat(parsedData)
      queryStartTime = data.reportData.report.events.nextPageTimestamp
    }

    return allEvents
  }

  /**
   * Fetches sumary data of a Single Player like rDPS, aDPS, nDPS, cDPS
   */
  async function fetchPlayerSumary(code: string, fightIDs: number[], playerID: number, fightStartTime: number, fightEndTime: number) {
    if (!reportMetadata.value[code]) {
      fetchReport(code, fightIDs)
    }

    if (!fightEndTime || !fightStartTime) {
      return
    }

    const [rateLimitData, data] = await Promise.all([
      ql.fetchRateLimitData(token.value!),
      ql.fetchReportPlayerSummary(token.value!, { code, fightIDs, startTime: fightStartTime, endTime: fightEndTime, sourceID: playerID }),
    ])

    quota.value = rateLimitData.rateLimitData
    const tableData = (data.reportData.report.table as { data: TableData }).data
    playerSummary.value[code] = tableData
    return tableData
  }

  // Fetches title, startTime, endTime, and the full fights list for a report.
  // Rate limit and report data are fetched in parallel to save a round-trip.
  async function fetchReport(code: string, fightIDs: number[]): Promise<ReportMeta | undefined> {
    await ensureToken()

    loading.value = true
    error.value = null

    let returnData: ReportMeta | undefined

    try {
      await ensureToken()

      const [rateLimitData, reportData] = await Promise.all([
        ql.fetchRateLimitData(token.value!),
        ql.fetchReportMeta(token.value!, { code, fightIDs }),
      ])

      quota.value = rateLimitData.rateLimitData
      returnData = reportData.reportData.report
      reportMetadata.value[code] = returnData
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
    return returnData
  }

  // Fetches all actors in the report and resolves which ones were active in the given fights.
  // fightIDs defaults to [] which the FFLogs API interprets as "all fights".
  async function fetchPlayers(code: string, fightIDs: number[] = []) {
    if (reportPlayers.value[code]) return // already cached

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
      const activeIDs = new Set(report.fights.flatMap((f) => f.friendlyPlayers))
      lastReportPlayers.value = curatePlayers(report.masterData.actors, activeIDs)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function fetchTopPlayers(job: string, code: string): Promise<TopPlayerDto[]> {
    const encounterID = reportMetadata.value[code]?.fights[0]?.encounterID
    if (!encounterID) {
      error.value = 'no fight'
      return []
    }
    const data = await ql.fetchTopPlayers(token.value!, { specName: job, encounterID })

    const topRankings = (data.worldData.encounter.characterRankings as CharacterRankings).rankings?.splice(0, maxPlayerToCompare.value) ?? []
    const chads = topRankings.map((ranking) => ({
      name: ranking.name,
      spec: ranking.spec,
      report: ranking.report as TopPlayerReport,
    })) as TopPlayerDto[]

    topPlayers.value[`${job}-${encounterID}`] = chads
    return chads
  }

  async function fetchPlayerDetails(code: string, fightIDs: number[]): Promise<ReportPlayersRoles> {
    await ensureToken()
    const data = await ql.fetchPlayerDetails(token.value!, { fightIDs, code })
    const typedData = data.reportData.report.playerDetails as ReportPlayersDetails
    return typedData.data.playerDetails
  }

  /**
   * Fetches sumary data of a Single Player like rDPS, aDPS, nDPS, cDPS
   */
  async function fetchPlayerGraph(code: string, fightIDs: number[], playerID: number, fightStartTime: number, fightEndTime: number) {
    await ensureToken()

    if (!fightEndTime || !fightStartTime) {
      return
    }

    const [rateLimitData, data] = await Promise.all([
      ql.fetchRateLimitData(token.value!),
      ql.fetchPlayerGraph(token.value!, { code, fightIDs, startTime: fightStartTime, endTime: fightEndTime, sourceID: playerID }),
    ])

    quota.value = rateLimitData.rateLimitData
    const graphData = (data.reportData.report.graph as { data: GraphData }).data
    return graphData
  }

  // MARK: Helper functions

  function curatePlayers(actors: Actor[], activeIDs: Set<number>): Actor[] {
    // Limit Break appears as a player in friendlyPlayers but is not a real player slot
    return actors.filter((a) => activeIDs.has(a.id) && a.subType !== 'LimitBreak')
  }

  function curatePlayerSummary(playerID: number, tableData: TableData | undefined): PlayerSummary | undefined {
    if (!tableData) {
      error.value = 'no Table Data'
      return undefined
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
    if (tableData.entries) {
      tableData.entries.forEach((entry) => {
        totalDamage += entry.total
        rDPS += toNum(entry.totalRDPS)
        aDPS += toNum(entry.totalADPS)
        nDPS += toNum(entry.totalNDPS)
        cDPS += toNum(entry.totalCDPS)

        if (entry.hitCount) {
          const cominedTotalHit = entry.hitCount + entry.multistrikeHitCount
          totalCrit += entry.critHitCount / cominedTotalHit
          totalDH += entry.multistrikeHitCount / cominedTotalHit

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
      crit: totalCrit / totalHittableActions,
      directHit: totalDH / totalHittableActions,
    }
    return playerSmallSummary.value[playerID]
  }

  function calcDPS(total: number, tableData: TableData): number {
    if (!tableData.damageDowntime) {
      return total / tableData.combatTime
    }
    const activeTime = tableData.combatTime - tableData.damageDowntime //idk why /1000 makes no difference here
    return total / activeTime
  }

  return {
    token,
    reports: reportMetadata,
    loading,
    reportPlayers,
    lastReportPlayers,
    topPlayers,
    playerSmallSummary,
    error,
    quota,
    selectedPlayerGraphData,
    selectedPlayerTableData,
    selectedPlayerPhaseCombatTime,
    fetchReport,
    fetchPlayers,
    fetchPlayerSumary,
    curatePlayerSummary,
    fetchPlayerGraph,
    fetchAllEvents,
    fetchTopPlayers,
    fetchPlayerDetails,
    saveSelectedPlayer,
  }
})
