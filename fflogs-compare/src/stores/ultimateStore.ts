import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { fetchCharacterUltimateKills } from '@/api/useQuery'
import { characterArgs, characterLabel, fflogsToken, isCharacter, sameCharacter, type FFLogsCharacter } from '@/api/fflogsCharacter'
import { ultimateRaids, type UltimateRaid } from '@/constants/ultimateWeapons'
import { useAuthStore } from './authStore'
import { useProfileStore } from './profileStore'
import { syncUltimateToGear } from './weaponSync'

// Saved per account in the ultimateWeapons setting, each keyed by raid:
// owned: the jobs whose weapon the ultimate has given. Unlike relics there are no stages: each weapon is had or not,
//   in any order.
// totems: how many of the ultimate's totems are held (any job's weapon takes one)
// consumed: the jobs whose weapon used up a held totem when it was ticked, so unticking gives it back
// logged: the clears FF Logs had at the last sync, so the next one only adds new ones
// syncedFor: the character (the profile's FF Logs character) those clears are of; another one starts over
// best: the character's best ranked kill of each ultimate at the last sync (see BestLog)
// syncedAt: when that was (ms)
type UltimateState = {
  owned: Record<string, string[]>
  totems: Record<string, number>
  consumed: Record<string, string[]>
  syncedFor?: FFLogsCharacter
  logged: Record<string, number>
  best: Record<string, BestLog>
  syncedAt?: number
}

// A ranked kill: its parse (percentile, 0-100) against everyone's kills of that encounter, the job it was on, its rDPS,
// when it was (ms) and where (report code, fight id)
export type BestLog = { percent: number; spec: string; amount: number; startTime: number; report: string; fight: number }

// One entry of encounterRankings' ranks, as far as it's used
type Rank = { rankPercent?: number; spec?: string; amount?: number; startTime?: number; report?: { code?: string; fightID?: number } }

const toBestLog = (r: Rank): BestLog | undefined =>
  typeof r.rankPercent === 'number' && typeof r.spec === 'string' && typeof r.report?.code === 'string' && Number.isInteger(r.report.fightID)
    ? { percent: r.rankPercent, spec: r.spec, amount: r.amount ?? 0, startTime: r.startTime ?? 0, report: r.report.code, fight: r.report.fightID! }
    : undefined

// The best parse (ties: the higher rDPS) among ranks
function bestOf(ranks: readonly Rank[]): BestLog | undefined {
  let best: BestLog | undefined
  for (const rank of ranks) {
    const log = toBestLog(rank)
    if (log && (!best || log.percent > best.percent || (log.percent === best.percent && log.amount > best.amount))) best = log
  }
  return best
}

const isBestLog = (v: unknown): v is BestLog => {
  const b = v as Partial<BestLog> | null
  return (
    !!b &&
    typeof b.percent === 'number' &&
    typeof b.spec === 'string' &&
    typeof b.amount === 'number' &&
    typeof b.startTime === 'number' &&
    typeof b.report === 'string' &&
    /^[A-Za-z0-9]{1,32}$/.test(b.report) &&
    Number.isInteger(b.fight)
  )
}

// More than anyone would hold; keeps a typo from turning into a huge saving
export const MAX_TOTEMS = 999

const emptyState = (): UltimateState => ({ owned: {}, totems: {}, consumed: {}, logged: {}, best: {} })

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

// Drop unknown raids and jobs and clamp counts, so an old or tampered save still loads.
// Saves from before totems were tracked are just the `owned` map.
function normalize(saved: unknown): UltimateState {
  const state = emptyState()
  if (!saved || typeof saved !== 'object') return state
  const raw = saved as Partial<Record<keyof UltimateState, unknown>>
  const legacy = !('owned' in raw)
  const owned = (legacy ? raw : raw.owned) as Record<string, unknown> | undefined
  const totems = (legacy ? undefined : raw.totems) as Record<string, unknown> | undefined
  const consumed = (legacy ? undefined : raw.consumed) as Record<string, unknown> | undefined
  const logged = (legacy ? undefined : raw.logged) as Record<string, unknown> | undefined
  const best = (legacy ? undefined : raw.best) as Record<string, unknown> | undefined
  if (!legacy && isCharacter(raw.syncedFor)) {
    state.syncedFor = raw.syncedFor
    if (isCount(raw.syncedAt)) state.syncedAt = raw.syncedAt
  }
  for (const raid of ultimateRaids) {
    const jobs = owned?.[raid.key]
    const had = Array.isArray(jobs) ? raid.jobs.filter((job) => jobs.includes(job)) : []
    if (had.length) state.owned[raid.key] = had
    // Only owned weapons can have used a totem up
    const used = consumed?.[raid.key]
    const kept = Array.isArray(used) ? had.filter((job) => used.includes(job)) : []
    if (kept.length) state.consumed[raid.key] = kept
    const held = totems?.[raid.key]
    if (isCount(held) && held > 0) state.totems[raid.key] = Math.min(held, MAX_TOTEMS)
    // Synced clears only mean something for the character they came from
    const clears = logged?.[raid.key]
    if (state.syncedFor && isCount(clears)) state.logged[raid.key] = clears
    const log = best?.[raid.key]
    if (state.syncedFor && isBestLog(log)) state.best[raid.key] = log
  }
  return state
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const useUltimateStore = defineStore('ultimate', () => {
  const state = ref<UltimateState>(emptyState())

  // On login (and account switch): start empty, then load this user's weapons. `loaded` resolves to whether they came
  // in, so changes made from elsewhere (a gear set's weapon) don't save over they before it's there.
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
          const { value } = await apiFetch<{ value: unknown }>('/settings/ultimateWeapons')
          if (auth.user?.id !== userId) return false // switched account meanwhile
          state.value = normalize(value)
          return true
        } catch (err) {
          console.error("Couldn't load ultimate weapons", err)
          return false
        }
      })()
    },
    { immediate: true },
  )
  const whenLoaded = () => loaded

  const has = (raid: UltimateRaid, job: string) => state.value.owned[raid.key]?.includes(job) ?? false

  const countFor = (raid: UltimateRaid) => state.value.owned[raid.key]?.length ?? 0

  const totemsHeld = (raid: UltimateRaid) => state.value.totems[raid.key] ?? 0

  // Whether ticking this job's weapon used up a held totem
  const usedTotem = (raid: UltimateRaid, job: string) => state.value.consumed[raid.key]?.includes(job) ?? false

  // Optimistic: apply the change to a copy and show it now; put the previous state back if the save fails.
  // Resolves to whether the save stuck.
  async function save(change: (next: UltimateState) => void, what: string): Promise<boolean> {
    const previous = state.value
    // A plain copy: structuredClone can't take the reactive proxy
    const next = JSON.parse(JSON.stringify(previous)) as UltimateState
    change(next)
    state.value = next
    try {
      await apiFetch('/settings/ultimateWeapons', { method: 'PUT', body: { value: next } })
      return true
    } catch (err) {
      state.value = previous
      message.error(`Couldn't save ${what}: ${errorText(err)}`)
      return false
    }
  }

  // Lists are kept in the raid's job order; empty ones are dropped
  const setJobs = (map: Record<string, string[]>, raid: UltimateRaid, jobs: Set<string>) => {
    if (jobs.size) map[raid.key] = raid.jobs.filter((j) => jobs.has(j))
    else delete map[raid.key]
  }

  // Ticking a weapon uses up a held totem if there is one, and remembers it did; unticking gives back what it used.
  // No totem held: the weapon is still ticked, nothing is used.
  function setHad(next: UltimateState, raid: UltimateRaid, jobs: readonly string[], had: boolean) {
    const owned = new Set(next.owned[raid.key] ?? [])
    const consumed = new Set(next.consumed[raid.key] ?? [])
    let totems = next.totems[raid.key] ?? 0
    for (const job of jobs) {
      if (!had && owned.delete(job)) {
        if (consumed.delete(job)) totems = Math.min(totems + 1, MAX_TOTEMS)
      } else if (had && !owned.has(job)) {
        owned.add(job)
        if (totems > 0) {
          totems--
          consumed.add(job)
        }
      }
    }
    setJobs(next.owned, raid, owned)
    setJobs(next.consumed, raid, consumed)
    if (totems) next.totems[raid.key] = totems
    else delete next.totems[raid.key]
  }

  // Gear sets whose weapon is one of these jobs' weapons from the ultimate follow (see weaponSync)
  async function saveHad(raid: UltimateRaid, jobs: readonly string[], had: boolean) {
    if (await save((next) => setHad(next, raid, jobs, had), 'ultimate weapons')) void syncUltimateToGear(raid, jobs)
  }

  function toggle(raid: UltimateRaid, job: string) {
    return saveHad(raid, [job], !has(raid, job))
  }

  // Every job's weapon at once, in the given order (so held totems go to the jobs listed first); same totem rule as
  // ticking each one
  function setAll(raid: UltimateRaid, had: boolean, jobs: readonly string[] = raid.jobs) {
    return saveHad(raid, jobs, had)
  }

  function setTotemsHeld(raid: UltimateRaid, count: number) {
    const clamped = Math.min(Math.max(0, Math.floor(count) || 0), MAX_TOTEMS)
    if (clamped === totemsHeld(raid)) return
    return save((next) => {
      if (clamped) next.totems[raid.key] = clamped
      else delete next.totems[raid.key]
    }, 'totems')
  }

  // The character whose clears are synced: the one in the profile
  const profile = useProfileStore()
  const character = computed(() => profile.fflogsCharacter)
  // Only counts for the profile's current character
  const current = computed(() => sameCharacter(state.value.syncedFor, character.value))
  const syncedAt = computed(() => (current.value ? state.value.syncedAt : undefined))
  // Clears FF Logs had at the last sync; undefined before the first
  const loggedClears = (raid: UltimateRaid) => (current.value ? state.value.logged[raid.key] : undefined)
  // Best ranked kill at the last sync; undefined before the first, or without one
  const bestLog = (raid: UltimateRaid) => (current.value ? state.value.best[raid.key] : undefined)

  const syncing = ref(false)

  // Count the character's clears of each ultimate on FF Logs (public logs only, all jobs) and add the totems they dropped
  // (one a clear). The first sync of an ultimate makes sure at least clears - weapons owned are held (each weapon took one);
  // later ones add only the clears since, so totems taken off by hand (lost, thrown away) stay off. Logs deleted since don't
  // take totems away. A character other than the last synced one starts over. Also notes each ultimate's best parse, across
  // all its encounter ids (each a percentile of that release's kills). Returns how many totems were added, or throws.
  async function syncClears(): Promise<number> {
    const char = character.value
    if (!char) throw new Error('No FF Logs character in your profile')
    syncing.value = true
    try {
      const data = await fetchCharacterUltimateKills(
        await fflogsToken(),
        characterArgs(char) as unknown as Parameters<typeof fetchCharacterUltimateKills>[1],
      )
      const found = data.characterData.character
      if (!found) throw new Error(`${characterLabel(char)} isn't on FF Logs`)
      if (found.hidden) throw new Error(`${found.name} has their rankings hidden on FF Logs`)
      const rankings = found as unknown as Record<string, { totalKills?: number; ranks?: Rank[] } | null>
      const clears = (raid: UltimateRaid) => raid.encounters.reduce((sum, id) => sum + (rankings[`e${id}`]?.totalKills ?? 0), 0)
      const best = (raid: UltimateRaid) => bestOf(raid.encounters.flatMap((id) => rankings[`e${id}`]?.ranks ?? []))
      let added = 0
      await save((next) => {
        // A different character was picked while this was loading: its clears aren't these
        if (!sameCharacter(profile.fflogsCharacter, char)) return
        if (!sameCharacter(next.syncedFor, char)) next.logged = {}
        next.best = {}
        next.syncedFor = char
        for (const raid of ultimateRaids) {
          const now = clears(raid)
          const before = next.logged[raid.key]
          const held = next.totems[raid.key] ?? 0
          const owned = next.owned[raid.key]?.length ?? 0
          const after = Math.min(before === undefined ? Math.max(held, now - owned) : held + Math.max(0, now - before), MAX_TOTEMS)
          added += after - held
          if (after) next.totems[raid.key] = after
          else delete next.totems[raid.key]
          next.logged[raid.key] = Math.max(now, before ?? 0)
          const log = best(raid)
          if (log) next.best[raid.key] = log
        }
        next.syncedAt = Date.now()
      }, 'synced clears')
      return added
    } finally {
      syncing.value = false
    }
  }

  return {
    whenLoaded,
    has,
    countFor,
    totemsHeld,
    usedTotem,
    toggle,
    setAll,
    setTotemsHeld,
    character,
    syncedAt,
    loggedClears,
    bestLog,
    syncing,
    syncClears,
  }
})
