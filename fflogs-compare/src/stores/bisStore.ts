import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { EquipmentStatus, isAccessory } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { tomeCosts } from '@/constants/tomeCosts'
import { useAuthStore } from './authStore'

// Only slots the user has changed; anything missing is EquipmentStatus.RAID
type SavedSlots = Record<string, Record<number, EquipmentStatus>>
// Linked slots only: job -> slot -> group id. Jobs with the same group id on a slot share it.
type Links = Record<string, Record<number, number>>

export type Materials = { tomes: number; twines: number; glazes: number }

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const useBisStore = defineStore('bis', () => {
  const slots = ref<SavedSlots>({})
  const links = ref<Links>({})
  const loading = ref(false)

  async function fetchState() {
    const state = await apiFetch<{ slots: SavedSlots; links: Links }>('/bis')
    slots.value = state.slots
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

  // Optimistic: update the UI now (the server mirrors this to linked jobs), roll back if it fails
  async function setStatus(job: string, slotIndex: number, status: EquipmentStatus) {
    const affected = [job, ...linkedOnSlot(job, slotIndex)]
    const previous = affected.map((j) => statusOf(j, slotIndex))
    for (const j of affected) (slots.value[j] ??= {})[slotIndex] = status
    try {
      await apiFetch(`/bis/${job}/${slotIndex}`, { method: 'PUT', body: { status } })
    } catch (err) {
      affected.forEach((j, i) => (slots.value[j]![slotIndex] = previous[i]!))
      message.error(`Couldn't save: ${errorText(err)}`)
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

  // Items across `jobs` that still cost something. A linked item is one purchase,
  // so it's listed once however many of the jobs share it.
  function neededPieces(jobs: readonly string[]): (Materials & { job: string; slot: number })[] {
    const seen = new Set<string>()
    const pieces: (Materials & { job: string; slot: number })[] = []
    for (const job of jobs) {
      bisSlots.forEach((_, slot) => {
        const cost = costOf(slot, statusOf(job, slot))
        if (!cost.tomes && !cost.twines && !cost.glazes) return
        const groupId = links.value[job]?.[slot]
        const key = groupId === undefined ? `${job}:${slot}` : `group:${slot}:${groupId}`
        if (seen.has(key)) return
        seen.add(key)
        pieces.push({ job, slot, ...cost })
      })
    }
    return pieces
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
      links.value = {}
    },
  )

  return {
    slots,
    links,
    loading,
    load,
    statusOf,
    linkedOnSlot,
    isLinked,
    linkedWith,
    setStatus,
    saveLinks,
    neededPieces,
    materialsNeeded,
    highlight,
    isHighlighted,
  }
})
