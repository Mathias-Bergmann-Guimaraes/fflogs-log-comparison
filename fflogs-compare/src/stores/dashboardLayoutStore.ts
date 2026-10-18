import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { useAuthStore } from './authStore'

// Order, width and visibility of the BiS dashboard widgets.
// Saved per account on the server; this browser keeps a copy per user so the page opens with it straight away.
export type WidgetId = 'kpis' | 'thisWeek' | 'shopping' | 'stock' | 'burndown' | 'jobStatus' | 'raidLoot' | 'roles'

// Column span on wide screens (out of 24); narrow screens always stack full width
export type WidgetSpan = 8 | 12 | 16 | 24

export type WidgetLayout = {
  id: WidgetId
  span: WidgetSpan
  hidden: boolean
}

export const widgetTitles: Record<WidgetId, string> = {
  kpis: 'Key figures',
  thisWeek: 'Buy this week',
  shopping: 'Shopping list',
  stock: 'Your stock',
  burndown: 'Items left to buy',
  jobStatus: 'Gear status per job',
  raidLoot: 'Who needs what',
  roles: 'By role',
}

// Before layouts were per user there was one copy per browser; it seeds the first save
const LEGACY_KEY = 'bis-dashboard-layout'
const cacheKey = (userId: number) => `bis-dashboard-layout:${userId}`
const SAVE_DELAY_MS = 600

const defaultLayout = (): WidgetLayout[] => [
  { id: 'kpis', span: 24, hidden: false },
  { id: 'stock', span: 12, hidden: false },
  { id: 'shopping', span: 12, hidden: false },
  { id: 'thisWeek', span: 8, hidden: false },
  { id: 'burndown', span: 8, hidden: false },
  { id: 'jobStatus', span: 8, hidden: false },
  { id: 'raidLoot', span: 24, hidden: false },
  { id: 'roles', span: 24, hidden: false },
]

// Keep the saved order, drop unknown widgets and append any added since it was saved
function normalize(saved: unknown): WidgetLayout[] | null {
  if (!Array.isArray(saved)) return null
  const defaults = defaultLayout()
  const known = saved
    .map((entry) => {
      const fallback = defaults.find((widget) => widget.id === entry?.id)
      if (!fallback) return null
      const span = [8, 12, 16, 24].includes(entry.span) ? entry.span : fallback.span
      return { id: fallback.id, span, hidden: entry.hidden === true }
    })
    .filter((widget): widget is WidgetLayout => widget !== null)
  const missing = defaults.filter((widget) => !known.some((entry) => entry.id === widget.id))
  return [...known, ...missing]
}

function readCache(key: string): WidgetLayout[] | null {
  try {
    return normalize(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return null // Storage blocked or corrupt
  }
}

function writeCache(key: string, layout: WidgetLayout[]) {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // Storage unavailable: the server copy still has it
  }
}

export const useDashboardLayoutStore = defineStore('dashboardLayout', () => {
  const widgets = ref<WidgetLayout[]>(defaultLayout())
  const editing = ref(false)

  const auth = useAuthStore()
  // Set while a layout is being applied from storage, so that isn't saved straight back
  let applying = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function apply(layout: WidgetLayout[]) {
    applying = true
    widgets.value = layout
    applying = false // the save watcher is sync, so it has already run
  }

  // On login (and account switch): this user's cached copy now, then the server's
  watch(
    () => auth.user?.id,
    async (userId) => {
      clearTimeout(saveTimer)
      editing.value = false
      if (userId === undefined) return apply(defaultLayout())

      const cached = readCache(cacheKey(userId)) ?? readCache(LEGACY_KEY)
      apply(cached ?? defaultLayout())
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/dashboardLayout')
        if (auth.user?.id !== userId) return // switched account meanwhile
        const saved = normalize(value)
        if (saved) {
          apply(saved)
          writeCache(cacheKey(userId), saved)
        } else if (cached) {
          // Nothing on the server yet: keep the layout this browser had
          await apiFetch('/settings/dashboardLayout', { method: 'PUT', body: { value: cached } })
        }
      } catch (err) {
        console.error("Couldn't load the dashboard layout", err)
      }
    },
    { immediate: true },
  )

  // Changes: cached at once, sent to the server once they settle (dragging fires several in a row)
  watch(
    widgets,
    (value) => {
      const userId = auth.user?.id
      if (applying || userId === undefined) return
      writeCache(cacheKey(userId), value)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        apiFetch('/settings/dashboardLayout', { method: 'PUT', body: { value } }).catch((err) => {
          message.error(`Couldn't save the dashboard layout: ${err instanceof Error ? err.message : String(err)}`)
        })
      }, SAVE_DELAY_MS)
    },
    // Sync so `applying` is still set when a loaded layout triggers it
    { deep: true, flush: 'sync' },
  )

  // Move a widget to where another one sits
  function move(id: WidgetId, targetId: WidgetId) {
    const from = widgets.value.findIndex((widget) => widget.id === id)
    const to = widgets.value.findIndex((widget) => widget.id === targetId)
    if (from < 0 || to < 0 || from === to) return
    const [widget] = widgets.value.splice(from, 1)
    widgets.value.splice(to, 0, widget!)
  }

  // Returns an undo that restores the previous layout
  function reset(): () => void {
    const previous = widgets.value.map((widget) => ({ ...widget }))
    widgets.value = defaultLayout()
    return () => (widgets.value = previous)
  }

  return { widgets, editing, move, reset }
})
