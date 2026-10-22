import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { relicSeries, type RelicSeries } from '@/constants/relicWeapons'
import { useAuthStore } from './authStore'

// Saved per account in the relicWeapons setting:
// done: how many stages of each series every job has finished, series key -> job -> count (stages are done in order).
//   Missing means none.
// stones: the stage items held (a stage cost's `via`, e.g. arcanite), series key -> count per stage index. They're per
//   stage, not per job: any job's weapon at that stage takes them.
// consumed: the stages whose items were used up when they were ticked, series key -> job -> stage indexes, so unticking
//   gives them back
type RelicState = {
  done: Record<string, Record<string, number>>
  stones: Record<string, number[]>
  consumed: Record<string, Record<string, number[]>>
}

// More than anyone would hold; keeps a typo from turning into a huge saving
export const MAX_STONES = 999

const emptyState = (): RelicState => ({ done: {}, stones: {}, consumed: {} })

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

// Drop unknown series, jobs and stages and clamp counts, so an old or tampered save still loads.
// Saves from before stones were tracked are just the `done` map.
function normalize(saved: unknown): RelicState {
  const state = emptyState()
  if (!saved || typeof saved !== 'object') return state
  const raw = saved as Partial<Record<keyof RelicState, unknown>>
  const legacy = !('done' in raw)
  const done = (legacy ? raw : raw.done) as Record<string, unknown> | undefined
  const stones = (legacy ? undefined : raw.stones) as Record<string, unknown> | undefined
  const consumed = (legacy ? undefined : raw.consumed) as Record<string, unknown> | undefined
  for (const series of relicSeries) {
    const doneByJob = done?.[series.key] as Record<string, unknown> | undefined
    const consumedByJob = consumed?.[series.key] as Record<string, unknown> | undefined
    for (const job of series.jobs) {
      const count = doneByJob?.[job]
      if (!isCount(count) || count === 0) continue
      const stagesDone = Math.min(count, series.stages.length)
      ;(state.done[series.key] ??= {})[job] = stagesDone
      // Only stages that are done (and pay with an item) can have used items up
      const used = consumedByJob?.[job]
      const kept = Array.isArray(used) ? [...new Set(used.filter((i) => isCount(i) && i < stagesDone && series.costs?.[i]?.via))] : []
      if (kept.length) (state.consumed[series.key] ??= {})[job] = kept.sort((a, b) => a - b)
    }
    const held = stones?.[series.key]
    if (Array.isArray(held) && series.costs?.some((cost) => cost?.via)) {
      state.stones[series.key] = series.stages.map((_, i) => (series.costs?.[i]?.via && isCount(held[i]) ? Math.min(held[i], MAX_STONES) : 0))
    }
  }
  return state
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const useRelicStore = defineStore('relic', () => {
  const state = ref<RelicState>(emptyState())

  // On login (and account switch): start empty, then load this user's progress
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    async (userId) => {
      state.value = emptyState()
      if (userId === undefined) return
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/relicWeapons')
        if (auth.user?.id !== userId) return // switched account meanwhile
        state.value = normalize(value)
      } catch (err) {
        console.error("Couldn't load relic weapon progress", err)
      }
    },
    { immediate: true },
  )

  const stagesDone = (series: RelicSeries, job: string) => state.value.done[series.key]?.[job] ?? 0

  // Every job in the series has every stage
  const isSeriesComplete = (series: RelicSeries) => series.jobs.every((job) => stagesDone(series, job) === series.stages.length)

  const stonesHeld = (series: RelicSeries, stage: number) => state.value.stones[series.key]?.[stage] ?? 0

  // Whether ticking this job's stage used up held items
  const usedStones = (series: RelicSeries, job: string, stage: number) => state.value.consumed[series.key]?.[job]?.includes(stage) ?? false

  // Optimistic: apply the change to a copy and show it now; put the previous state back if the save fails
  async function save(change: (next: RelicState) => void, what: string) {
    const previous = state.value
    // A plain copy: structuredClone can't take the reactive proxy
    const next = JSON.parse(JSON.stringify(previous)) as RelicState
    change(next)
    state.value = next
    try {
      await apiFetch('/settings/relicWeapons', { method: 'PUT', body: { value: next } })
    } catch (err) {
      state.value = previous
      message.error(`Couldn't save ${what}: ${errorText(err)}`)
    }
  }

  // Ticking a stage finishes it and every stage before it; unticking it undoes it and every stage after it.
  // Each stage newly finished uses up its items (perWeapon of them) if that many are held, and remembers it did;
  // each stage undone gives back what it used. Fewer held than needed: the stage is still ticked, nothing is used.
  function toggleStage(series: RelicSeries, job: string, stageIndex: number) {
    const before = stagesDone(series, job)
    const after = before > stageIndex ? stageIndex : stageIndex + 1
    return save((next) => {
      const stones = (next.stones[series.key] ??= series.stages.map(() => 0))
      const consumedByJob = (next.consumed[series.key] ??= {})
      const used = new Set(consumedByJob[job] ?? [])
      for (let i = before; i < after; i++) {
        const via = series.costs?.[i]?.via
        if (via && (stones[i] ?? 0) >= via.perWeapon) {
          stones[i] = (stones[i] ?? 0) - via.perWeapon
          used.add(i)
        }
      }
      for (let i = after; i < before; i++) {
        const via = series.costs?.[i]?.via
        if (via && used.delete(i)) stones[i] = Math.min((stones[i] ?? 0) + via.perWeapon, MAX_STONES)
      }
      if (used.size) consumedByJob[job] = [...used].sort((a, b) => a - b)
      else delete consumedByJob[job]
      // Series without stage items keep no stone counts
      if (!series.costs?.some((cost) => cost?.via)) delete next.stones[series.key]
      if (!Object.keys(consumedByJob).length) delete next.consumed[series.key]
      const doneByJob = (next.done[series.key] ??= {})
      if (after) doneByJob[job] = after
      else delete doneByJob[job]
    }, 'relic progress')
  }

  function setStonesHeld(series: RelicSeries, stage: number, count: number) {
    const clamped = Math.min(Math.max(0, Math.floor(count) || 0), MAX_STONES)
    if (clamped === stonesHeld(series, stage)) return
    return save((next) => {
      ;(next.stones[series.key] ??= series.stages.map(() => 0))[stage] = clamped
    }, 'stones')
  }

  return { stagesDone, isSeriesComplete, stonesHeld, usedStones, toggleStage, setStonesHeld }
})
