import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToken } from '@/api/auth'
import { queryModules } from '@/api/useQuery'
import * as FFLogs from './fflogsDataType'


export const useFFLogsStore = defineStore('fflogs', () => {
  const token = ref<string | null>(null)
  const reports = ref<Record<string, FFLogs.Report>>({})
  const reportPlayers = ref<Record<string, FFLogs.ReportPlayers>>({})
  const lastReportPlayers = ref<FFLogs.PlayerDetails[]>()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const quota = ref<FFLogs.RateLimitData | null>(null)

  async function ensureToken() {
    if (!token.value) {
      token.value = await getToken()
    }
  }

  async function fetchReport(code: string) {
    if (reports.value[code]) return

    loading.value = true
    error.value = null

    try {
      await ensureToken()

      const data = await queryModules(token.value!, ['rateLimitData', 'reportData'], { code })

      quota.value = data.rateLimitData
      reports.value[code] = data.reportData.report
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function fetchPlayers(report: FFLogs.ReportURL) {
    if (reports.value[report.code]) return

    loading.value = true
    error.value = null

    try {
      await ensureToken()
      const code = report.code
      const fightIDs = report.fightIDs
      console.log({code: report.code, fightIDs: report.fightIDs});

      const data = await queryModules(token.value!, ['rateLimitData', 'reportPlayers'], { code, fightIDs })

      quota.value = data.rateLimitData
      reportPlayers.value[report.code] = data.reportData.report
      const uniqueActivePlayerId = [... new Set(data.reportData.report.fights?.flatMap(fight => fight.friendlyPlayers))]

      lastReportPlayers.value = curatePlayers(data.reportData.report.masterData.actors, uniqueActivePlayerId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  function curatePlayers(allPlayers: FFLogs.PlayerDetails[], activePlayerIDs: number[]): FFLogs.PlayerDetails[]{
    // filter for only those players who are in the selected fights
    // Limit Break is included in the active player so we need to remove it manualy
    return allPlayers.filter((player) => activePlayerIDs.includes(player.id) && player.subType !== 'LimitBreak')
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
    fetchPlayers }
})
