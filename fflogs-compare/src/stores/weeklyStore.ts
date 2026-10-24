import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { nextWeeklyReset } from '@/composables/useBisPlan'
import { weeklyActivities, type WeeklyActivity } from '@/constants/weeklyActivities'
import { useAuthStore } from './authStore'

// This week's weekly checklist, saved per account.
//   resetsAt: the reset the progress belongs to; past it, the progress is thrown away
//   progress: times each activity was done this week (1 for a plain checkbox)
//   hidden: activities the user doesn't do, left out of the list
//   favorites: activities pinned to the Favorites category at the top, in the order they were added
type WeeklyState = { resetsAt: number; progress: Record<string, number>; hidden: string[]; favorites: string[] }

const byId = new Map(weeklyActivities.map((a) => [a.id, a]))
const maxFor = (activity: WeeklyActivity) => activity.count ?? 1

const emptyState = (): WeeklyState => ({ resetsAt: nextWeeklyReset().getTime(), progress: {}, hidden: [], favorites: [] })

// Unknown activities and out-of-range counts are dropped; a past week's progress is reset (hidden and favorites stay)
function normalize(saved: unknown): WeeklyState {
  const state = emptyState()
  if (!saved || typeof saved !== 'object') return state
  const raw = saved as Record<string, unknown>
  if (Array.isArray(raw.hidden)) state.hidden = raw.hidden.filter((id): id is string => typeof id === 'string' && byId.has(id))
  if (Array.isArray(raw.favorites)) state.favorites = [...new Set(raw.favorites.filter((id): id is string => typeof id === 'string' && byId.has(id)))]
  if (raw.resetsAt !== state.resetsAt || !raw.progress || typeof raw.progress !== 'object') return state
  for (const [id, value] of Object.entries(raw.progress as Record<string, unknown>)) {
    const activity = byId.get(id)
    if (activity && typeof value === 'number' && Number.isInteger(value) && value > 0) state.progress[id] = Math.min(value, maxFor(activity))
  }
  return state
}

export const useWeeklyStore = defineStore('weekly', () => {
  const state = ref<WeeklyState>(emptyState())

  // On login (and account switch): an empty week, then this user's checklist
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    async (userId) => {
      state.value = emptyState()
      if (userId === undefined) return
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/weekly')
        if (auth.user?.id !== userId) return // switched account meanwhile
        state.value = normalize(value)
      } catch (err) {
        console.error("Couldn't load the weekly checklist", err)
      }
    },
    { immediate: true },
  )

  // Ticks every minute so the countdown runs and the checklist clears at the reset without a reload
  const now = ref(Date.now())
  setInterval(() => (now.value = Date.now()), 60_000)
  const resetsAt = computed(() => nextWeeklyReset(new Date(now.value)).getTime())
  watch(resetsAt, () => (state.value = normalize(state.value)))

  // Optimistic: apply now, roll back if the save fails
  async function save(next: WeeklyState) {
    const previous = state.value
    state.value = next
    try {
      await apiFetch('/settings/weekly', { method: 'PUT', body: { value: next } })
    } catch (err) {
      state.value = previous
      message.error(`Couldn't save the weekly checklist: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const doneCount = (id: string) => state.value.progress[id] ?? 0
  const isDone = (activity: WeeklyActivity) => doneCount(activity.id) >= maxFor(activity)
  const isHidden = (id: string) => state.value.hidden.includes(id)
  const isFavorite = (id: string) => state.value.favorites.includes(id)

  function setDone(activity: WeeklyActivity, count: number) {
    const progress = { ...state.value.progress }
    const value = Math.min(Math.max(0, Math.round(count)), maxFor(activity))
    if (value) progress[activity.id] = value
    else delete progress[activity.id]
    void save({ ...state.value, resetsAt: resetsAt.value, progress })
  }

  function setHidden(id: string, hidden: boolean) {
    const rest = state.value.hidden.filter((h) => h !== id)
    void save({ ...state.value, hidden: hidden ? [...rest, id] : rest })
  }

  function setFavorite(id: string, favorite: boolean) {
    const rest = state.value.favorites.filter((f) => f !== id)
    void save({ ...state.value, favorites: favorite ? [...rest, id] : rest })
  }

  function resetWeek() {
    void save({ ...state.value, resetsAt: resetsAt.value, progress: {} })
  }

  const visible = computed(() => weeklyActivities.filter((a) => !isHidden(a.id)))
  const summary = computed(() => {
    const done = visible.value.filter(isDone).length
    const total = visible.value.length
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
  })

  return {
    now,
    resetsAt,
    doneCount,
    isDone,
    isHidden,
    isFavorite,
    setDone,
    setHidden,
    setFavorite,
    resetWeek,
    summary,
    hiddenCount: computed(() => state.value.hidden.length),
    favorites: computed(() => state.value.favorites.map((id) => byId.get(id)!)),
  }
})
