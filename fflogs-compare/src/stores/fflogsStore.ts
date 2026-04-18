import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getToken } from '@/api/auth'
import { query, REPORT_QUERY } from '@/api/fflogs'
import type { Fight, Report, RateLimitData } from './fflogsDataType'


export const useFFLogsStore = defineStore('fflogs', () => {
  const token = ref<string | null>(null)
  const reports = ref<Record<string, Report>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const quota = ref<RateLimitData | null>(null)

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

      const data = await query<{ rateLimitData: RateLimitData; reportData: { report: Report } }>(
        token.value!,
        REPORT_QUERY,
        { code }
      )

      quota.value = data.rateLimitData
      reports.value[code] = data.reportData.report
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return { token, reports, loading, error, quota, fetchReport }
})
