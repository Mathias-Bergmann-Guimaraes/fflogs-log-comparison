import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToken } from '@/api/auth'
import { fetchRateLimitData, fetchReportMeta, fetchReportPlayers, fetchReportData } from '@/api/useQuery'
import type { RateLimitDataQuery, ReportMetaQuery, ReportPlayersQuery } from '@/api/__generated__/graphql'

// Unwrap the nested query shape into flat, reusable types
type ReportMeta = ReportMetaQuery['reportData']['report']
type ReportPlayers = ReportPlayersQuery['reportData']['report']
type Actor = ReportPlayers['masterData']['actors'][number]

export const useFFLogsStore = defineStore('fflogs', () => {
  // Cached OAuth token — fetched once on first API call, reused for all subsequent calls
  const token = ref<string | null>(null)

  // Keyed by report code to avoid re-fetching the same report across navigations
  const reports = ref<Record<string, ReportMeta>>({})
  const reportPlayers = ref<Record<string, ReportPlayers>>({})

  // Players who participated in the selected fights, with LimitBreak filtered out
  const lastReportPlayers = ref<Actor[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)

  // FFLogs rate limit state — useful for showing the user how many API points remain
  const quota = ref<RateLimitDataQuery['rateLimitData'] | null>(null)

  // Lazily fetches and caches the OAuth token using client credentials from .env
  async function ensureToken() {
    if (!token.value) {
      token.value = await getToken()
    }
  }

  // FFLogs paginates events via nextPageTimestamp — this loops until all pages are collected.
  // startTime advances each iteration to the timestamp where the previous page ended.
  async function fetchAllEvents(code: string, fightIDs: number[], startTime: number, endTime: number) {
    const allEvents: unknown[] = []
    let nextPage: number | null = startTime

    while (nextPage !== null) {
      const data = await fetchReportData(token.value!, { code, fightIDs, startTime: nextPage, endTime })
      const events = data.reportData.report.events
      if (events?.data) allEvents.push(...(events.data as unknown[]))
      nextPage = events?.nextPageTimestamp ?? null
    }

    return allEvents
  }

  // Fetches title, startTime, endTime, and the full fights list for a report.
  // Rate limit and report data are fetched in parallel to save a round-trip.
  async function fetchReport(code: string) {
    if (reports.value[code]) return  // already cached

    loading.value = true
    error.value = null

    try {
      await ensureToken()

      const [rateLimitData, reportData] = await Promise.all([
        fetchRateLimitData(token.value!),
        fetchReportMeta(token.value!, { code }),
      ])

      quota.value = rateLimitData.rateLimitData
      reports.value[code] = reportData.reportData.report
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
        fetchRateLimitData(token.value!),
        fetchReportPlayers(token.value!, { code, fightIDs }),
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

  function curatePlayers(actors: Actor[], activeIDs: Set<number>): Actor[] {
    // Limit Break appears as a player in friendlyPlayers but is not a real player slot
    return actors.filter(a => activeIDs.has(a.id) && a.subType !== 'LimitBreak')
  }

  return {
    token,
    reports,
    loading,
    reportPlayers,
    lastReportPlayers,
    error,
    quota,
    fetchReport,
    fetchPlayers,
    fetchAllEvents,
  }
})
