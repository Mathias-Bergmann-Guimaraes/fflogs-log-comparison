import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { RaidFloor } from '@/constants/raidFloors'
import { EquipmentType } from '@/types/EquipmentType'

// What the player already holds, for the dashboard's week estimates.
// Kept in this browser only (localStorage), not on the server.
export type Stock = {
  tomes: number
  tomesEarnedThisWeek: number
  books: Record<RaidFloor, number>
  floorsClearedThisWeek: Record<RaidFloor, boolean>
  twines: number
  glazes: number
  // Unopened coffers per slot type
  coffers: Record<EquipmentType, number>
}

const STORAGE_KEY = 'bis-stock'

const emptyStock = (): Stock => ({
  tomes: 0,
  tomesEarnedThisWeek: 0,
  books: { 1: 0, 2: 0, 3: 0, 4: 0 },
  floorsClearedThisWeek: { 1: false, 2: false, 3: false, 4: false },
  twines: 0,
  glazes: 0,
  coffers: emptyCoffers(),
})

const emptyCoffers = () =>
  Object.fromEntries(
    Object.values(EquipmentType)
      .filter((type) => typeof type === 'number')
      .map((type) => [type, 0]),
  ) as Record<EquipmentType, number>

function loadStock(): Stock {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    // Coffers merge too, so a save from before they (or a slot) existed still loads
    if (saved && typeof saved === 'object') return { ...emptyStock(), ...saved, coffers: { ...emptyCoffers(), ...saved.coffers } }
  } catch {
    // Storage blocked or corrupt: start empty
  }
  return emptyStock()
}

export const useStockStore = defineStore('stock', () => {
  const stock = ref<Stock>(loadStock())

  watch(
    stock,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Storage unavailable: the values just won't survive a reload
      }
    },
    { deep: true },
  )

  // Both resets return an undo that puts back only the fields they cleared
  function resetTomes(): () => void {
    const { tomes, tomesEarnedThisWeek } = stock.value
    stock.value.tomes = 0
    stock.value.tomesEarnedThisWeek = 0
    return () => Object.assign(stock.value, { tomes, tomesEarnedThisWeek })
  }

  // Raid books (and this week's clears) plus twines and glazes
  function resetBooksAndUpgrades(): () => void {
    const before = {
      books: { ...stock.value.books },
      floorsClearedThisWeek: { ...stock.value.floorsClearedThisWeek },
      twines: stock.value.twines,
      glazes: stock.value.glazes,
    }
    const empty = emptyStock()
    Object.assign(stock.value, { books: empty.books, floorsClearedThisWeek: empty.floorsClearedThisWeek, twines: 0, glazes: 0 })
    return () => Object.assign(stock.value, before)
  }

  // Clearing a floor earns its book, so marking it adds one; unmarking takes that book back
  function setFloorCleared(floor: RaidFloor, cleared: boolean) {
    if (stock.value.floorsClearedThisWeek[floor] === cleared) return
    stock.value.floorsClearedThisWeek[floor] = cleared
    stock.value.books[floor] = Math.min(99, Math.max(0, stock.value.books[floor] + (cleared ? 1 : -1)))
  }

  function resetCoffers(): () => void {
    const coffers = { ...stock.value.coffers }
    stock.value.coffers = emptyCoffers()
    return () => (stock.value.coffers = coffers)
  }

  return { stock, resetTomes, resetBooksAndUpgrades, resetCoffers, setFloorCleared }
})
