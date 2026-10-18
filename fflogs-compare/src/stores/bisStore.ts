import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { EquipmentStatus, isAccessory, type GearSource } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { tomeCosts } from '@/constants/tomeCosts'
import { floorOf, raidFloors, type RaidFloor, type RaidNeeds } from '@/constants/raidFloors'
import { useAuthStore } from './authStore'

// Only slots the user has changed; anything missing is EquipmentStatus.RAID
type SavedSlots = Record<string, Record<number, EquipmentStatus>>
// Where each saved slot's piece comes from; the server keeps it when a slot becomes Acquired
type SavedSources = Record<string, Record<number, GearSource>>
// Linked slots only: job -> slot -> group id. Jobs with the same group id on a slot share it.
type Links = Record<string, Record<number, number>>

export type Materials = { tomes: number; twines: number; glazes: number }

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const useBisStore = defineStore('bis', () => {
  const slots = ref<SavedSlots>({})
  const sources = ref<SavedSources>({})
  const links = ref<Links>({})
  const loading = ref(false)

  async function fetchState() {
    const state = await apiFetch<{ slots: SavedSlots; sources: SavedSources; links: Links }>('/bis')
    slots.value = state.slots
    sources.value = state.sources
    links.value = state.links
  }

  async function load() {
    loading.value = true
    try {
      await fetchState()
    } finally {
      loading.value = false
    }
  }

  function statusOf(job: string, slotIndex: number): EquipmentStatus {
    return slots.value[job]?.[slotIndex] ?? EquipmentStatus.RAID
  }

  // The piece the slot is after, or got: Raid is the raid piece, Tome/Twine/Glaze the tome one,
  // and Acquired keeps whichever it was before (same rule as the server)
  function sourceOf(job: string, slotIndex: number): GearSource {
    const status = statusOf(job, slotIndex)
    if (status === EquipmentStatus.ACQUIRED) return sources.value[job]?.[slotIndex] ?? 'raid'
    return status === EquipmentStatus.RAID ? 'raid' : 'tome'
  }

  // Other jobs sharing this slot with `job`, excluding the job itself
  function linkedOnSlot(job: string, slotIndex: number): string[] {
    const groupId = links.value[job]?.[slotIndex]
    if (groupId === undefined) return []
    return Object.keys(links.value).filter((j) => j !== job && links.value[j]?.[slotIndex] === groupId)
  }

  function isLinked(job: string, other: string, slotIndex: number) {
    return linkedOnSlot(job, slotIndex).includes(other)
  }

  // Other jobs sharing at least one slot with `job`
  function linkedWith(job: string): string[] {
    const slotIndexes = Object.keys(links.value[job] ?? {}).map(Number)
    return [...new Set(slotIndexes.flatMap((i) => linkedOnSlot(job, i)))]
  }

  // Optimistic: update the UI now (the server mirrors this to linked jobs), roll back if it fails.
  // Resolves to whether the save stuck, for callers that do more on success.
  async function setStatus(job: string, slotIndex: number, status: EquipmentStatus): Promise<boolean> {
    const affected = [job, ...linkedOnSlot(job, slotIndex)]
    const previous = affected.map((j) => statusOf(j, slotIndex))
    // Read before the status changes, so Acquired picks up the source the slot had
    const previousSources = affected.map((j) => sourceOf(j, slotIndex))
    for (const j of affected) (slots.value[j] ??= {})[slotIndex] = status
    affected.forEach(
      (j, i) => ((sources.value[j] ??= {})[slotIndex] = status === EquipmentStatus.ACQUIRED ? previousSources[i]! : sourceOf(j, slotIndex)),
    )
    try {
      await apiFetch(`/bis/${job}/${slotIndex}`, { method: 'PUT', body: { status } })
      return true
    } catch (err) {
      affected.forEach((j, i) => {
        slots.value[j]![slotIndex] = previous[i]!
        sources.value[j]![slotIndex] = previousSources[i]!
      })
      message.error(`Couldn't save: ${errorText(err)}`)
      return false
    }
  }

  // What each unfinished item still costs. A Tome item needs the tome piece and then its upgrade
  // (twine for armour, glaze for accessories); a Twine/Glaze item only needs the upgrade.
  function costOf(slot: number, status: EquipmentStatus): Materials {
    const type = bisSlots[slot]!
    const upgrade = status === EquipmentStatus.TOME || status === EquipmentStatus.TWINE || status === EquipmentStatus.GLAZE ? 1 : 0
    return {
      tomes: status === EquipmentStatus.TOME ? tomeCosts[type] : 0,
      twines: isAccessory(type) ? 0 : upgrade,
      glazes: isAccessory(type) ? upgrade : 0,
    }
  }

  // Each item across `jobs` once: a linked item is a single purchase however many of the jobs share it
  function uniqueSlots(jobs: readonly string[], keep: (job: string, slot: number) => boolean): { job: string; slot: number }[] {
    const seen = new Set<string>()
    const result: { job: string; slot: number }[] = []
    for (const job of jobs) {
      bisSlots.forEach((_, slot) => {
        if (!keep(job, slot)) return
        const groupId = links.value[job]?.[slot]
        const key = groupId === undefined ? `${job}:${slot}` : `group:${slot}:${groupId}`
        if (seen.has(key)) return
        seen.add(key)
        result.push({ job, slot })
      })
    }
    return result
  }

  // Items across `jobs` that still cost tomes, twines or glazes
  function neededPieces(jobs: readonly string[]): (Materials & { job: string; slot: number })[] {
    return uniqueSlots(jobs, (job, slot) => {
      const cost = costOf(slot, statusOf(job, slot))
      return cost.tomes + cost.twines + cost.glazes > 0
    }).map((p) => ({ ...p, ...costOf(p.slot, statusOf(p.job, p.slot)) }))
  }

  // A job counts as tracked once any item has been changed: Raid is the default status,
  // so untouched jobs would otherwise each "need" every raid item
  function isTracked(job: string) {
    return Object.keys(slots.value[job] ?? {}).length > 0
  }

  // Every BiS item acquired
  function isComplete(job: string) {
    return bisSlots.every((_, i) => statusOf(job, i) === EquipmentStatus.ACQUIRED)
  }

  // Raid items still needed across tracked `jobs`, with the floor that drops them
  function raidPieces(jobs: readonly string[]): { job: string; slot: number; floor: RaidFloor }[] {
    return uniqueSlots(jobs.filter(isTracked), (job, slot) => statusOf(job, slot) === EquipmentStatus.RAID).flatMap((p) => {
      const floor = floorOf(p.slot)
      return floor ? [{ ...p, floor }] : []
    })
  }

  // Books to buy every raid item still needed, per floor (items x that floor's book cost)
  function booksNeeded(jobs: readonly string[]): RaidNeeds {
    const books: RaidNeeds = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const p of raidPieces(jobs)) books[p.floor] += raidFloors.find((f) => f.floor === p.floor)!.bookCost
    return books
  }

  function materialsNeeded(jobs: readonly string[]): Materials {
    return neededPieces(jobs).reduce((sum, p) => ({ tomes: sum.tomes + p.tomes, twines: sum.twines + p.twines, glazes: sum.glazes + p.glazes }), {
      tomes: 0,
      twines: 0,
      glazes: 0,
    })
  }

  // Sets exactly which slots `job` shares with each listed job; newly linked slots take on `job`'s statuses.
  // Throws so the link dialog can stay open on failure.
  async function saveLinks(job: string, wanted: Record<string, number[]>) {
    await apiFetch(`/bis/${job}/links`, { method: 'PUT', body: { links: wanted } })
    await fetchState()
  }

  // What the pointer is over, so linked cards can highlight the shared items:
  // a single item (`slot`), or everything `job` shares with `other`
  const highlight = ref<{ job: string; slot: number } | { job: string; other: string } | null>(null)

  function isHighlighted(job: string, slotIndex: number) {
    const h = highlight.value
    if (!h) return false
    if ('slot' in h) return h.slot === slotIndex && linkedOnSlot(h.job, slotIndex).length > 0 && (h.job === job || isLinked(h.job, job, slotIndex))
    return (h.job === job && isLinked(job, h.other, slotIndex)) || (h.other === job && isLinked(job, h.job, slotIndex))
  }

  // Don't leak one user's gear into the next account on the same tab
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    () => {
      slots.value = {}
      sources.value = {}
      links.value = {}
    },
  )

  return {
    slots,
    links,
    loading,
    load,
    statusOf,
    sourceOf,
    linkedOnSlot,
    isLinked,
    linkedWith,
    setStatus,
    saveLinks,
    neededPieces,
    isTracked,
    isComplete,
    raidPieces,
    booksNeeded,
    materialsNeeded,
    highlight,
    isHighlighted,
  }
})
