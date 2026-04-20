import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToken } from '@/api/auth'
import { fetchRateLimitData, fetchReportMeta, fetchReportPlayers, fetchReportData } from '@/api/useQuery'
import type { RateLimitDataQuery, ReportMetaQuery, ReportPlayersQuery } from '@/api/__generated__/graphql'

type ReportMeta = ReportMetaQuery['reportData']['report']
type ReportPlayers = ReportPlayersQuery['reportData']['report']
type Actor = ReportPlayers['masterData']['actors'][number]

export const useFFLogsStore = defineStore('fflogs', () => {
  const token = ref<string | null>(null)
  const reports = ref<Record<string, ReportMeta>>({})
  const reportPlayers = ref<Record<string, ReportPlayers>>({})
  const lastReportPlayers = ref<Actor[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const quota = ref<RateLimitDataQuery['rateLimitData'] | null>(null)

  async function ensureToken() {
    if (!token.value) {
      token.value = await getToken()
    }
  }

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

  async function fetchReport(code: string) {
    if (reports.value[code]) return

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

  async function fetchPlayers(code: string, fightIDs: number[] = []) {
    if (reportPlayers.value[code]) return

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

      const activeIDs = new Set(report.fights.flatMap(f => f.friendlyPlayers))
      lastReportPlayers.value = curatePlayers(report.masterData.actors, activeIDs)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  function curatePlayers(actors: Actor[], activeIDs: Set<number>): Actor[] {
    // Limit Break has its own actor entry and must be excluded manually
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
