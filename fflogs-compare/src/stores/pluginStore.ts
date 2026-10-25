import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { apiFetch } from '@/api/backend'
import { cofferDefs } from '@/constants/coffers'
import { raidFloors, upgradeItemIds, type RaidFloor } from '@/constants/raidFloors'
import { MAX_TOMES_HELD, TOME_ITEM_ID } from '@/constants/tomeCosts'
import type { EquipmentType } from '@/types/EquipmentType'
import type { PluginData } from '@/types/plugin'
import { useAuthStore } from './authStore'
import { useStockStore, type Stock } from './stockStore'
import { clampProgress, useWeeklyStore } from './weeklyStore'

// What the game plugin has sent (server/plugin.ts) for the character heard from last, and where it goes in the app.
// Each new snapshot is copied once into the stock (inventory, this week's tomestones) and the weekly checklist;
// edits by hand after that stay until the next snapshot. PluginMark marks a value while it's still the plugin's.
//
// Field keys, for PluginMark: the Stock field ('tomes', 'tomesEarnedThisWeek', 'books.<floor>', 'twines', 'glazes',
// 'coffers.<EquipmentType>'), 'weekly.<activity id>', or 'wondrousTails.stickers' / 'wondrousTails.secondChancePoints'
export type PluginValue = { value: number; capturedAt: number }

// The plugin's mark (PluginMark, and gear slots the character has); gray where it could fill in a value but hasn't
export const PLUGIN_COLOR = '#13c2c2'
export const PLUGIN_TRACKABLE_COLOR = '#595959'
export const PLUGIN_TRACKABLE_TEXT = 'The game plugin can track this'

const REFRESH_MS = 5 * 60_000
// Coming back to the tab reloads, at most this often
const FOCUS_REFRESH_MS = 30_000
const WEEK_MS = 7 * 24 * 3_600_000
// The StockCounter's limit
const MAX_COUNT = 99
// Custom Delivery allowances a week
const DELIVERY_ALLOWANCES = 12

type InventoryStock = Pick<Stock, 'tomes' | 'books' | 'twines' | 'glazes' | 'coffers'>

export const usePluginStore = defineStore('plugin', () => {
  const auth = useAuthStore()
  const stockStore = useStockStore()
  const weeklyStore = useWeeklyStore()

  const data = ref<PluginData | null>(null)
  let loadedAt = 0

  // Best effort: without it the pages just show what was entered by hand
  async function load() {
    const userId = auth.user?.id
    if (userId === undefined) return
    loadedAt = Date.now()
    try {
      const received = await apiFetch<PluginData>('/plugin/data')
      if (auth.user?.id === userId) data.value = received
    } catch (err) {
      console.error("Couldn't load the game plugin's data", err)
    }
  }

  watch(
    () => auth.user?.id,
    (userId) => {
      data.value = null
      if (userId !== undefined) void load()
    },
    { immediate: true },
  )
  setInterval(() => {
    if (document.visibilityState === 'visible') void load()
  }, REFRESH_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - loadedAt > FOCUS_REFRESH_MS) void load()
  })

  // The server lists characters most recently heard from first
  const character = computed(() => data.value?.characters[0])
  const characterName = computed(() => {
    const c = character.value?.snapshots.character?.data
    return c ? `${c.name} (${c.world})` : undefined
  })

  // This week's only: last week's progress went at the reset
  const weekly = computed(() => {
    const snapshot = character.value?.snapshots.weekly
    return snapshot && snapshot.capturedAt >= weeklyStore.resetsAt - WEEK_MS ? snapshot : undefined
  })

  const inventoryStock = computed((): { capturedAt: number; stock: InventoryStock } | undefined => {
    const snapshot = character.value?.snapshots.inventory
    if (!snapshot) return undefined
    const counts = new Map(snapshot.data.items.map((i) => [i.itemId, i.count]))
    const count = (itemId: number, max = MAX_COUNT) => Math.min(counts.get(itemId) ?? 0, max)
    // The weekly snapshot names the current tomestone, when the plugin sends it
    const tomeId = character.value?.snapshots.weekly?.data.tomestones?.itemId ?? TOME_ITEM_ID
    return {
      capturedAt: snapshot.capturedAt,
      stock: {
        tomes: count(tomeId, MAX_TOMES_HELD),
        books: Object.fromEntries(raidFloors.map((f) => [f.floor, count(f.bookItemId)])) as Record<RaidFloor, number>,
        twines: count(upgradeItemIds.twine),
        glazes: count(upgradeItemIds.glaze),
        coffers: Object.fromEntries(cofferDefs.map((c) => [c.type, count(c.itemId)])) as Record<EquipmentType, number>,
      },
    }
  })

  const tomesEarned = computed(() => weekly.value?.data.tomestones?.earned)

  // The checklist's numbers: what the plugin read for each activity, Custom Deliveries from the allowances left
  const weeklyProgress = computed(() => {
    const w = weekly.value?.data
    if (!w) return undefined
    const deliveries = w.customDeliveries && { customDeliveries: DELIVERY_ALLOWANCES - w.customDeliveries.allowancesLeft }
    return { ...deliveries, ...w.activities }
  })

  // The items the character has, wherever the plugin saw them (bags, equipped, saved gearsets), with when it read them.
  // The gear sets mark those slots Acquired (bisStore).
  const owned = computed(() => {
    const out = new Map<number, number>()
    const add = (itemId: number, capturedAt: number) => out.set(itemId, Math.max(out.get(itemId) ?? 0, capturedAt))
    const s = character.value?.snapshots
    for (const i of s?.inventory?.data.items ?? []) if (i.count) add(i.itemId, s!.inventory!.capturedAt)
    for (const i of s?.gear?.data.items ?? []) add(i.itemId, s!.gear!.capturedAt)
    for (const set of s?.gearsets?.data.sets ?? []) for (const i of set.items) add(i.itemId, s!.gearsets!.capturedAt)
    return out
  })
  // When the plugin last saw the character with the item; undefined if it hasn't
  const owns = (itemId: number) => owned.value.get(itemId)

  const fields = computed(() => {
    const out = new Map<string, PluginValue>()
    const inv = inventoryStock.value
    if (inv) {
      const { stock, capturedAt } = inv
      out.set('tomes', { value: stock.tomes, capturedAt })
      out.set('twines', { value: stock.twines, capturedAt })
      out.set('glazes', { value: stock.glazes, capturedAt })
      for (const [floor, value] of Object.entries(stock.books)) out.set(`books.${floor}`, { value, capturedAt })
      for (const [type, value] of Object.entries(stock.coffers)) out.set(`coffers.${type}`, { value, capturedAt })
    }
    const w = weekly.value
    if (w) {
      const { capturedAt } = w
      if (tomesEarned.value !== undefined) out.set('tomesEarnedThisWeek', { value: tomesEarned.value, capturedAt })
      if (w.data.wondrousTails) {
        out.set('wondrousTails.stickers', { value: w.data.wondrousTails.stickers, capturedAt })
        out.set('wondrousTails.secondChancePoints', { value: w.data.wondrousTails.secondChancePoints, capturedAt })
      }
      for (const [id, count] of Object.entries(weeklyProgress.value ?? {})) {
        const value = clampProgress(id, count)
        if (value !== undefined) out.set(`weekly.${id}`, { value, capturedAt })
      }
    }
    return out
  })

  // The plugin's value for a field, while the app's (current) still matches it; without current, whenever there is one
  function sent(field: string, current?: number): PluginValue | undefined {
    const v = fields.value.get(field)
    return v && (current === undefined || v.value === current) ? v : undefined
  }

  // Copies each snapshot not copied yet. A different character's counts as new, so switching to an alt takes its data.
  watch(
    [inventoryStock, () => weekly.value?.capturedAt, tomesEarned, weeklyProgress, () => weeklyStore.loaded],
    () => {
      const stock = stockStore.stock
      const applied = (stock.pluginCapturedAt ??= {})
      const inv = inventoryStock.value
      if (inv && applied.inventory !== inv.capturedAt) {
        // A copy, so changing a count by hand doesn't change the snapshot's
        Object.assign(stock, structuredClone(inv.stock))
        applied.inventory = inv.capturedAt
      }
      const w = weekly.value
      if (w && tomesEarned.value !== undefined && applied.weekly !== w.capturedAt) {
        stock.tomesEarnedThisWeek = tomesEarned.value
        applied.weekly = w.capturedAt
      }
      if (w && weeklyProgress.value && weeklyStore.loaded && weeklyStore.pluginCapturedAt !== w.capturedAt) {
        weeklyStore.applyPlugin(weeklyProgress.value, w.capturedAt)
      }
    },
    { immediate: true },
  )

  return { data, load, characterName, weekly, owns, sent }
})
