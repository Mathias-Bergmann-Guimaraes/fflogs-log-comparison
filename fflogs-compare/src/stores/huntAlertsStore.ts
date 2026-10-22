import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import type { HuntRank } from '@/types/hunts'
import { DATA_CENTERS, type DataCenterName } from '@/views/hunts/dashboard/trains'
import { useAuthStore } from './authStore'

// Which hunts put a dot on the side menu: any rule matching is enough. 'any' matches every rank or every DC,
// so { rank: 'A', dc: 'Chaos' } is A ranks on Chaos and { rank: 'any', dc: 'Light' } is everything on Light.
export type HuntAlertRule = { rank: HuntRank | 'any'; dc: DataCenterName | 'any' }

export const HUNT_RANKS: HuntRank[] = ['A', 'S']

// Until the user saves their own: every A rank train, as before there were rules
export const DEFAULT_HUNT_ALERTS: HuntAlertRule[] = [{ rank: 'A', dc: 'any' }]

const isRule = (value: unknown): value is HuntAlertRule => {
  if (!value || typeof value !== 'object') return false
  const { rank, dc } = value as Record<string, unknown>
  return (
    (rank === 'any' || HUNT_RANKS.includes(rank as HuntRank)) &&
    (dc === 'any' || DATA_CENTERS.some((d) => d.name === dc))
  )
}

export const ruleMatches = (rule: HuntAlertRule, rank: HuntRank, dc: DataCenterName) =>
  (rule.rank === 'any' || rule.rank === rank) && (rule.dc === 'any' || rule.dc === dc)

// Saved per account in the huntAlerts setting
export const useHuntAlertsStore = defineStore('huntAlerts', () => {
  const rules = ref<HuntAlertRule[]>(DEFAULT_HUNT_ALERTS)

  // On login (and account switch): the defaults, then this user's rules
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    async (userId) => {
      rules.value = DEFAULT_HUNT_ALERTS
      if (userId === undefined) return
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/huntAlerts')
        if (auth.user?.id !== userId) return // switched account meanwhile
        if (Array.isArray(value)) rules.value = value.filter(isRule)
      } catch (err) {
        console.error("Couldn't load hunt alerts", err)
      }
    },
    { immediate: true },
  )

  const matches = (rank: HuntRank, dc: DataCenterName) => rules.value.some((rule) => ruleMatches(rule, rank, dc))

  // Optimistic: apply now, roll back if the save fails. Returns whether it saved.
  async function save(next: HuntAlertRule[]) {
    const previous = rules.value
    rules.value = next
    try {
      await apiFetch('/settings/huntAlerts', { method: 'PUT', body: { value: next } })
      return true
    } catch (err) {
      rules.value = previous
      message.error(`Couldn't save hunt alerts: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  return { rules, matches, save }
})
