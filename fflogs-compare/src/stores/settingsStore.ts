import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import type { ExpansionKey } from '@/views/hunts/dashboard/sRanks'
import type { TrainTypeKey } from '@/views/hunts/dashboard/trains'
import { useAuthStore } from './authStore'

// The app's tunable numbers, saved per account in the preferences setting (the Settings page edits them).
// Durations are kept in the units the page shows them in: minutes and hours.
//   weeklyTomeCap: the most tomestones a week can earn (450, or 900 while it's doubled)
//   sRankUpMinutes / ssRankUpMinutes: how long an S (SS) rank counts as up after it's reported
//   respawnMinHours / respawnMaxHours: when an expansion's A ranks start and finish respawning after a train
//   trainRunningMinutes: how long a train counts as running after its start; trainUntimedMinutes when the post gave no time
//   trainMarks: how many A ranks a train is assumed to do when its post doesn't say
//   *ByExpansion / *ByType: the advanced per-expansion overrides; a missing entry uses the value above
//   showPluginTrackable: also show the game plugin's mark, grayed out, on values it could fill in but hasn't (PluginMark)
export type RespawnOverride = { min?: number; max?: number }

export type Preferences = {
  weeklyTomeCap: number
  sRankUpMinutes: number
  ssRankUpMinutes: number
  respawnMinHours: number
  respawnMaxHours: number
  trainRunningMinutes: number
  trainUntimedMinutes: number
  trainMarks: number
  sRankUpByExpansion: Partial<Record<ExpansionKey, number>>
  ssRankUpByExpansion: Partial<Record<ExpansionKey, number>>
  respawnByType: Partial<Record<TrainTypeKey, RespawnOverride>>
  trainMarksByType: Partial<Record<TrainTypeKey, number>>
  showPluginTrackable: boolean
}

export const TOME_CAPS = [450, 900] as const

// What the app did before there were settings
export const DEFAULT_PREFERENCES: Preferences = {
  weeklyTomeCap: 450,
  sRankUpMinutes: 5,
  ssRankUpMinutes: 5,
  respawnMinHours: 3,
  respawnMaxHours: 6,
  trainRunningMinutes: 15,
  trainUntimedMinutes: 30,
  trainMarks: 12,
  sRankUpByExpansion: {},
  ssRankUpByExpansion: {},
  respawnByType: {},
  trainMarksByType: {},
  showPluginTrackable: false,
}

// What each number may be, for the page's inputs and for checking what's read back
export const LIMITS = {
  upMinutes: { min: 1, max: 60 },
  respawnHours: { min: 0.5, max: 24 },
  runningMinutes: { min: 5, max: 120 },
  trainMarks: { min: 1, max: 30 },
} as const

const EXPANSION_KEYS: ExpansionKey[] = [2, 3, 4, 5, 6, 7]
const TRAIN_TYPE_KEYS: TrainTypeKey[] = ['7.0', '6.0', '5.0', 'old']

const inRange = (value: unknown, { min, max }: { min: number; max: number }) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined

const record = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})

function overrides<K extends string | number>(keys: K[], saved: unknown, limits: { min: number; max: number }) {
  const raw = record(saved)
  const kept: Partial<Record<K, number>> = {}
  for (const k of keys) {
    const value = inRange(raw[String(k)], limits)
    if (value !== undefined) kept[k] = value
  }
  return kept
}

// Anything missing or out of range falls back to the default (or is clamped), and a window never ends before it starts
export function normalize(saved: unknown): Preferences {
  const raw = record(saved)
  const d = DEFAULT_PREFERENCES
  const respawnMinHours = inRange(raw.respawnMinHours, LIMITS.respawnHours) ?? d.respawnMinHours
  const respawnByType = record(raw.respawnByType)
  return {
    weeklyTomeCap: TOME_CAPS.includes(raw.weeklyTomeCap as (typeof TOME_CAPS)[number]) ? (raw.weeklyTomeCap as number) : d.weeklyTomeCap,
    sRankUpMinutes: inRange(raw.sRankUpMinutes, LIMITS.upMinutes) ?? d.sRankUpMinutes,
    ssRankUpMinutes: inRange(raw.ssRankUpMinutes, LIMITS.upMinutes) ?? d.ssRankUpMinutes,
    respawnMinHours,
    respawnMaxHours: Math.max(respawnMinHours, inRange(raw.respawnMaxHours, LIMITS.respawnHours) ?? d.respawnMaxHours),
    trainRunningMinutes: inRange(raw.trainRunningMinutes, LIMITS.runningMinutes) ?? d.trainRunningMinutes,
    trainUntimedMinutes: inRange(raw.trainUntimedMinutes, LIMITS.runningMinutes) ?? d.trainUntimedMinutes,
    trainMarks: inRange(raw.trainMarks, LIMITS.trainMarks) ?? d.trainMarks,
    sRankUpByExpansion: overrides(EXPANSION_KEYS, raw.sRankUpByExpansion, LIMITS.upMinutes),
    ssRankUpByExpansion: overrides(EXPANSION_KEYS, raw.ssRankUpByExpansion, LIMITS.upMinutes),
    respawnByType: Object.fromEntries(
      TRAIN_TYPE_KEYS.flatMap((k) => {
        const o = overrides(['min', 'max'], respawnByType[k], LIMITS.respawnHours)
        return o.min === undefined && o.max === undefined ? [] : [[k, o]]
      }),
    ),
    trainMarksByType: overrides(TRAIN_TYPE_KEYS, raw.trainMarksByType, LIMITS.trainMarks),
    showPluginTrackable: raw.showPluginTrackable === true,
  }
}

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

export const useSettingsStore = defineStore('settings', () => {
  const preferences = ref<Preferences>(DEFAULT_PREFERENCES)

  // On login (and account switch): the defaults, then this user's preferences
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    async (userId) => {
      preferences.value = DEFAULT_PREFERENCES
      if (userId === undefined) return
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/preferences')
        if (auth.user?.id !== userId) return // switched account meanwhile
        preferences.value = normalize(value)
      } catch (err) {
        console.error("Couldn't load settings", err)
      }
    },
    { immediate: true },
  )

  const weeklyTomeCap = computed(() => preferences.value.weeklyTomeCap)
  const showPluginTrackable = computed(() => preferences.value.showPluginTrackable)

  // An unknown expansion gets the general value
  function sRankUpMs(sRank: { ss: boolean; expansion: ExpansionKey | null }) {
    const p = preferences.value
    const [byExpansion, base] = sRank.ss ? [p.ssRankUpByExpansion, p.ssRankUpMinutes] : [p.sRankUpByExpansion, p.sRankUpMinutes]
    return ((sRank.expansion && byExpansion[sRank.expansion]) || base) * MINUTE_MS
  }

  // An override that would end the window before it starts is stretched to the start
  function respawnWindowMs(type: TrainTypeKey) {
    const p = preferences.value
    const o = p.respawnByType[type] ?? {}
    const min = o.min ?? p.respawnMinHours
    return { min: min * HOUR_MS, max: Math.max(min, o.max ?? p.respawnMaxHours) * HOUR_MS }
  }

  const trainRunningMs = (timed: boolean) => (timed ? preferences.value.trainRunningMinutes : preferences.value.trainUntimedMinutes) * MINUTE_MS

  // A ranks assumed per train of a type, when its post doesn't say
  const trainMarks = (type: TrainTypeKey | null) =>
    (type && preferences.value.trainMarksByType[type]) || preferences.value.trainMarks

  // Optimistic: apply now, roll back if the save fails. Returns whether it saved.
  async function save(next: Preferences) {
    const previous = preferences.value
    const value = normalize(next)
    preferences.value = value
    try {
      await apiFetch('/settings/preferences', { method: 'PUT', body: { value } })
      return true
    } catch (err) {
      preferences.value = previous
      message.error(`Couldn't save settings: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  return { preferences, weeklyTomeCap, showPluginTrackable, sRankUpMs, respawnWindowMs, trainRunningMs, trainMarks, save }
})
