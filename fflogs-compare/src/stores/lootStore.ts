import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { EquipmentStatus } from '@/types/EquipmentType'
import type { RaidFloor } from '@/constants/raidFloors'
import { nextWeeklyReset } from '@/composables/useBisPlan'

// What dropped this raid week, per "Who needs what" row (one drop per row a week).
// Kept in this browser only (localStorage); entries lapse at the weekly reset.
export type LootDrop = {
  // The weekly reset that ends this entry (ms)
  resetsAt: number
  floor: RaidFloor
  // null: it went into the stock (a coffer, twine or glaze). Otherwise who it was given to,
  // and the piece's status before, so it can be undone.
  given: { job: string; slot: number; jobs: string[]; previous: EquipmentStatus } | null
}

const STORAGE_KEY = 'bis-loot-this-week'
// Floors this card marked cleared (and so added a book for), keyed by floor, valued by the reset that ends it
const CLEARS_KEY = 'bis-loot-clears'

function load<T extends object>(key: string): T {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (saved && typeof saved === 'object') return saved
  } catch {
    // Storage blocked or corrupt: start empty
  }
  return {} as T
}

function persist(key: string, value: object) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: this week's drops just won't survive a reload
  }
}

export const useLootStore = defineStore('loot', () => {
  const drops = ref<Record<string, LootDrop>>(load(STORAGE_KEY))
  const clears = ref<Partial<Record<RaidFloor, number>>>(load(CLEARS_KEY))

  // Ticks every minute so entries disappear at the reset without a reload
  const now = ref(Date.now())
  setInterval(() => (now.value = Date.now()), 60_000)

  watch(drops, (value) => persist(STORAGE_KEY, value), { deep: true })
  watch(clears, (value) => persist(CLEARS_KEY, value), { deep: true })

  // This week's drops only
  const thisWeek = computed(() => Object.fromEntries(Object.entries(drops.value).filter(([, drop]) => drop.resetsAt > now.value)))

  const dropsOnFloor = (floor: RaidFloor) => Object.values(thisWeek.value).filter((drop) => drop.floor === floor).length

  function record(row: string, floor: RaidFloor, given: LootDrop['given']) {
    // Drop entries from past weeks while we're at it
    for (const [key, drop] of Object.entries(drops.value)) if (drop.resetsAt <= Date.now()) delete drops.value[key]
    drops.value[row] = { resetsAt: nextWeeklyReset().getTime(), floor, given }
  }

  function clear(row: string) {
    delete drops.value[row]
  }

  // Whether this card (not the player) marked `floor` cleared this week
  const markedClear = (floor: RaidFloor) => (clears.value[floor] ?? 0) > now.value
  function setMarkedClear(floor: RaidFloor, marked: boolean) {
    if (marked) clears.value[floor] = nextWeeklyReset().getTime()
    else delete clears.value[floor]
  }

  return { thisWeek, dropsOnFloor, record, clear, markedClear, setMarkedClear }
})
