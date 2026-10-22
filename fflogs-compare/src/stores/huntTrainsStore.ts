import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '@/api/backend'
import { useHuntAlertsStore } from '@/stores/huntAlertsStore'
import type { HuntTrainList } from '@/types/hunts'
import { fetchPingLabels } from '@/views/hunts/discordText'
import { dedupeTrains, isActive, parseTrain, type Train } from '@/views/hunts/dashboard/trains'

const REFRESH_MS = 60_000
const TICK_MS = 15_000

// The A rank trains, shared by the Hunt Dashboard and the header's hunt alerts (a dot while a train the user asked for is on).
// Kept fresh while anything watches it (see watch), so both read the same data from one poll.
export const useHuntTrainsStore = defineStore('huntTrains', () => {
  const data = ref<HuntTrainList | null>(null)
  const labels = ref<Record<string, string>>({})
  const loading = ref(false)
  // Message of the last failed load, null once one succeeds (or while loading)
  const error = ref<string | null>(null)
  const now = ref(Date.now())

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [list, names] = await Promise.all([apiFetch<HuntTrainList>('/hunts/trains'), fetchPingLabels()])
      data.value = list
      labels.value = names
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load hunt trains"
    } finally {
      loading.value = false
      now.value = Date.now()
    }
  }

  const parsed = computed(() => (data.value?.messages ?? []).map((m) => parseTrain(m, labels.value)))
  // Newest first, like the messages
  const trains = computed<Train[]>(() => dedupeTrains(parsed.value.filter((t) => t !== null)))

  // For the header's hunt alerts, only the trains the user's alert rules ask for (all of these are A ranks).
  // Running or still to come, soonest first: running ones (oldest start on top), then announced.
  const alerts = useHuntAlertsStore()
  const alertTrains = computed(() =>
    trains.value.filter((t) => isActive(t, now.value) && alerts.matches('A', t.dc)).sort((a, b) => a.startsAt - b.startsAt),
  )

  // Starts polling on the first watcher and stops after the last one; returns the function that stops watching
  let watchers = 0
  let timers: ReturnType<typeof setInterval>[] = []
  function watch() {
    if (watchers++ === 0) {
      load()
      timers = [setInterval(load, REFRESH_MS), setInterval(() => (now.value = Date.now()), TICK_MS)]
    }
    let stopped = false
    return () => {
      if (stopped) return
      stopped = true
      if (--watchers === 0) timers.forEach(clearInterval)
    }
  }

  // Forget the trains (on logout: they're only served to signed-in users)
  function clear() {
    data.value = null
    labels.value = {}
    error.value = null
  }

  return { data, labels, loading, error, now, parsed, trains, alertTrains, load, watch, clear }
})
