import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { relicSeries, type RelicSeries } from '@/constants/relicWeapons'
import { useAuthStore } from './authStore'
import { syncRelicToGear } from './weaponSync'

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

  // On login (and account switch): start empty, then load this user's progress. `loaded` resolves to whether it came
  // in, so changes made from elsewhere (a gear set's weapon) don't save over it before it's there.
  const auth = useAuthStore()
  let loaded = Promise.resolve(false)
  watch(
    () => auth.user?.id,
    (userId) => {
      state.value = emptyState()
      if (userId === undefined) {
        loaded = Promise.resolve(false)
        return
      }
      loaded = (async () => {
        try {
          const { value } = await apiFetch<{ value: unknown }>('/settings/relicWeapons')
          if (auth.user?.id !== userId) return false // switched account meanwhile
          state.value = normalize(value)
          return true
        } catch (err) {
          console.error("Couldn't load relic weapon progress", err)
          return false
        }
      })()
    },
    { immediate: true },
  )
  const whenLoaded = () => loaded

  const stagesDone = (series: RelicSeries, job: string) => state.value.done[series.key]?.[job] ?? 0

  // Every job in the series has every stage
  const isSeriesComplete = (series: RelicSeries) => series.jobs.every((job) => stagesDone(series, job) === series.stages.length)

  const stonesHeld = (series: RelicSeries, stage: number) => state.value.stones[series.key]?.[stage] ?? 0

  // Whether ticking this job's stage used up held items
  const usedStones = (series: RelicSeries, job: string, stage: number) => state.value.consumed[series.key]?.[job]?.includes(stage) ?? false

  // Optimistic: apply the change to a copy and show it now; put the previous state back if the save fails.
  // Resolves to whether the save stuck.
  async function save(change: (next: RelicState) => void, what: string): Promise<boolean> {
    const previous = state.value
    // A plain copy: structuredClone can't take the reactive proxy
    const next = JSON.parse(JSON.stringify(previous)) as RelicState
    change(next)
    state.value = next
    try {
      await apiFetch('/settings/relicWeapons', { method: 'PUT', body: { value: next } })
      return true
    } catch (err) {
      state.value = previous
      message.error(`Couldn't save ${what}: ${errorText(err)}`)
      return false
    }
  }

  // Ticking a stage finishes it and every stage before it; unticking it undoes it and every stage after it.
  // Each stage newly finished uses up its items (perWeapon of them) if that many are held, and remembers it did;
  // each stage undone gives back what it used. Fewer held than needed: the stage is still ticked, nothing is used.
  function setDone(next: RelicState, series: RelicSeries, job: string, after: number) {
    const before = next.done[series.key]?.[job] ?? 0
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
  }

  // Gear sets whose weapon is one of these jobs' weapons in the series follow (see weaponSync)
  async function saveProgress(change: (next: RelicState) => void, series: RelicSeries, jobs: readonly string[]) {
    if (await save(change, 'relic progress')) void syncRelicToGear(series, jobs)
  }

  function toggleStage(series: RelicSeries, job: string, stageIndex: number) {
    const after = stagesDone(series, job) > stageIndex ? stageIndex : stageIndex + 1
    return saveProgress((next) => setDone(next, series, job, after), series, [job])
  }

  // Every job at once, in role order like the table (so held items go to the jobs listed first): done finishes stages up
  // to and including `upTo` where they aren't yet; undone undoes `from` and after where they're done. Same items rule as
  // ticking each one.
  function setStageForAll(series: RelicSeries, from: number, upTo: number, done: boolean, jobs: readonly string[] = series.jobs) {
    return saveProgress(
      (next) => {
        for (const job of jobs) {
          const before = next.done[series.key]?.[job] ?? 0
          const after = done ? Math.max(before, upTo + 1) : Math.min(before, from)
          if (after !== before) setDone(next, series, job, after)
        }
      },
      series,
      jobs,
    )
  }

  function setStonesHeld(series: RelicSeries, stage: number, count: number) {
    const clamped = Math.min(Math.max(0, Math.floor(count) || 0), MAX_STONES)
    if (clamped === stonesHeld(series, stage)) return
    return save((next) => {
      ;(next.stones[series.key] ??= series.stages.map(() => 0))[stage] = clamped
    }, 'stones')
  }

  return { whenLoaded, stagesDone, isSeriesComplete, stonesHeld, usedStones, toggleStage, setStageForAll, setStonesHeld }
})
