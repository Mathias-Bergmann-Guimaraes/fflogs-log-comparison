import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { EquipmentStatus, EquipmentType, isAccessory, type GearSource } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { WEAPON_SLOT } from '@/constants/gearSharing'
import { tomeCosts } from '@/constants/tomeCosts'
import { floorOf, raidFloors, type RaidFloor, type RaidNeeds } from '@/constants/raidFloors'
import { equipmentIcons, gearPiece, type GearPiece } from '@/constants/icons'
import { gearItemIds } from '@/constants/gearItems'
import { ultimateWithin } from '@/constants/ultimates'
import { ultimateRaids } from '@/constants/ultimateWeapons'
import { useAuthStore } from './authStore'
import { useGearSetsStore } from './gearSetsStore'
import { useItemCatalogStore, type CatalogItem } from './itemCatalogStore'
import { syncGearToWeapons } from './weaponSync'

// Only slots the user has changed; anything missing is EquipmentStatus.RAID
type SavedSlots = Record<string, Record<number, EquipmentStatus>>
// Where each saved slot's piece comes from; the server keeps it when a slot becomes Acquired
type SavedSources = Record<string, Record<number, GearSource>>
// Slots pinned to a specific item: job -> slot -> item id. Unpinned slots show the automatic piece.
type SavedItems = Record<string, Record<number, number>>
// Linked slots only: job -> slot -> group id. Jobs with the same group id on a slot share it.
type Links = Record<string, Record<number, number>>

export type Materials = { tomes: number; twines: number; glazes: number; solvents: number }

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

// One gear set's BiS progress: the default set (id 0, this tier's gear for every job) or a custom one from gearSetsStore
const defineBisStore = (setId: number) =>
  defineStore(setId ? `bis-${setId}` : 'bis', () => {
    const slots = ref<SavedSlots>({})
    const sources = ref<SavedSources>({})
    const items = ref<SavedItems>({})
    const links = ref<Links>({})
    const loading = ref(false)
    // Whether this account's progress has come in at least once
    const loaded = ref(false)

    const base = setId ? `/gear-sets/${setId}/bis` : '/bis'
    const gearSets = useGearSetsStore()
    const catalog = useItemCatalogStore()
    // The custom set's definition (jobs, item level range); undefined for the default set
    const definition = computed(() => (setId ? gearSets.byId(setId) : undefined))

    async function fetchState() {
      const state = await apiFetch<{ slots: SavedSlots; sources: SavedSources; items: SavedItems; links: Links }>(base)
      slots.value = state.slots
      sources.value = state.sources
      items.value = state.items
      links.value = state.links
      loaded.value = true
      void catalog.ensureItems(Object.values(state.items).flatMap((bySlot) => Object.values(bySlot)))
    }

    async function load() {
      loading.value = true
      try {
        await fetchState()
      } finally {
        loading.value = false
      }
    }

    // Loads only if it hasn't yet, for the relic and ultimate pages updating sets that weren't opened
    const ensureLoaded = () => (loaded.value ? Promise.resolve() : load())

    // A custom set's pieces come from its item level range, looked up per job in the background
    watch(definition, (set) => set?.jobs.forEach((job) => void catalog.loadRange(job, set.minIlvl, set.maxIlvl)), { immediate: true })

    function statusOf(job: string, slotIndex: number): EquipmentStatus {
      return slots.value[job]?.[slotIndex] ?? EquipmentStatus.RAID
    }

    // The piece the slot is after, or got: Raid is the raid piece, Tome/Twine/Glaze/Solvent the tome one, Dungeon, Relic,
    // Trial and Ultimate their own, and Acquired keeps whichever it was before (same rule as the server)
    function sourceOf(job: string, slotIndex: number): GearSource {
      const status = statusOf(job, slotIndex)
      switch (status) {
        case EquipmentStatus.ACQUIRED:
          return sources.value[job]?.[slotIndex] ?? 'raid'
        case EquipmentStatus.RAID:
        case EquipmentStatus.DUNGEON:
        case EquipmentStatus.RELIC:
        case EquipmentStatus.TRIAL:
        case EquipmentStatus.ULTIMATE:
          return status
        default:
          return 'tome'
      }
    }

    const itemOf = (job: string, slotIndex: number): number | undefined => items.value[job]?.[slotIndex]

    // Whether the weapon can be an ultimate's: this tier has one (the default set), or the set's range takes one in
    function hasUltimate(job: string): boolean {
      const set = definition.value
      return set ? !!ultimateWithin(set.minIlvl, set.maxIlvl) : gearItemIds[job]?.[EquipmentType.WEAPON]?.ultimate !== undefined
    }

    // The item id of the weapon the slot is after, or got: its pinned item, else this tier's piece (the default set), else
    // for an ultimate the range's ultimate's weapon, else the range's automatic piece. undefined while unknown.
    function weaponItem(job: string): number | undefined {
      const pinned = itemOf(job, WEAPON_SLOT)
      if (pinned) return pinned
      const source = sourceOf(job, WEAPON_SLOT)
      const set = definition.value
      if (!set) return gearItemIds[job]?.[EquipmentType.WEAPON]?.[source]
      if (source === 'ultimate') {
        const ultimate = ultimateWithin(set.minIlvl, set.maxIlvl)
        return ultimateRaids.find((raid) => raid.name === ultimate?.name)?.weapons[job]
      }
      return catalog.autoPiece(job, set.minIlvl, set.maxIlvl, EquipmentType.WEAPON, source)?.id
    }

    // What the slot shows: its pinned item, else the piece its source points at (this tier's for the default set,
    // the range's for a custom one), else the generic slot icon
    function pieceOf(job: string, slotIndex: number): GearPiece {
      const type = bisSlots[slotIndex]!
      const pinned = itemOf(job, slotIndex)
      const set = definition.value
      const item = pinned ? catalog.items[pinned] : set && catalog.autoPiece(job, set.minIlvl, set.maxIlvl, type, sourceOf(job, slotIndex))
      if (item) return { icon: item.icon, name: `${item.name} (i${item.ilvl})` }
      if (pinned || set) return { icon: equipmentIcons[type], name: null }
      return gearPiece(job, type, sourceOf(job, slotIndex))
    }

    // Items a custom set's slot can be pinned to: the job's gear in the range, plus the pinned one if it's outside it.
    // undefined for the default set, which always shows this tier's pieces.
    function itemOptions(job: string, slotIndex: number): CatalogItem[] | undefined {
      const set = definition.value
      if (!set) return undefined
      const options = catalog.itemsFor(job, set.minIlvl, set.maxIlvl, bisSlots[slotIndex]!)
      const pinned = itemOf(job, slotIndex)
      const extra = pinned && !options.some((i) => i.id === pinned) ? catalog.items[pinned] : undefined
      return extra ? [extra, ...options] : options
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
    // Resolves to whether the save stuck, for callers that do more on success. A relic or ultimate weapon also updates the
    // Relic and Ultimate Weapons pages (see weaponSync).
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
        await apiFetch(`${base}/${job}/${slotIndex}`, { method: 'PUT', body: { status } })
        if (slotIndex === WEAPON_SLOT) void syncGearToWeapons(setId, affected, previous)
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

    // Pins the slot to an item (null: back to the automatic piece). Optimistic like setStatus; linked jobs follow.
    async function setItem(job: string, slotIndex: number, itemId: number | null) {
      const affected = [job, ...linkedOnSlot(job, slotIndex)]
      const previous = affected.map((j) => itemOf(j, slotIndex))
      const apply = (j: string, id: number | null | undefined) => {
        const bySlot = (items.value[j] ??= {})
        if (id) bySlot[slotIndex] = id
        else delete bySlot[slotIndex]
      }
      affected.forEach((j) => apply(j, itemId))
      // The server gives a slot with no row yet the default Raid status, so the job counts as tracked from now on
      for (const j of affected) (slots.value[j] ??= {})[slotIndex] ??= EquipmentStatus.RAID
      try {
        await apiFetch(`${base}/${job}/${slotIndex}/item`, { method: 'PUT', body: { itemId } })
      } catch (err) {
        affected.forEach((j, i) => apply(j, previous[i]))
        message.error(`Couldn't save: ${errorText(err)}`)
      }
    }

    // Several slots at once (an imported BiS set), optionally pinning items too; linked jobs follow on the server.
    // Throws so the import dialog can stay open.
    async function setStatuses(job: string, statuses: Record<number, EquipmentStatus>, pinned?: Record<number, number | null>) {
      const previous = statusOf(job, WEAPON_SLOT)
      await apiFetch(`${base}/${job}`, { method: 'PUT', body: { statuses, items: pinned } })
      await fetchState()
      void syncGearToWeapons(setId, [job], [previous])
    }

    // What each unfinished item still costs. A Tome item needs the tome piece and then its upgrade
    // (twine for armour, glaze for accessories, solvent for the weapon); a Twine/Glaze/Solvent item only needs the upgrade.
    function costOf(slot: number, status: EquipmentStatus): Materials {
      const type = bisSlots[slot]!
      const upgrade =
        status === EquipmentStatus.TOME || status === EquipmentStatus.TWINE || status === EquipmentStatus.GLAZE || status === EquipmentStatus.SOLVENT
          ? 1
          : 0
      const weapon = type === EquipmentType.WEAPON
      return {
        tomes: status === EquipmentStatus.TOME ? tomeCosts[type] : 0,
        twines: weapon || isAccessory(type) ? 0 : upgrade,
        glazes: isAccessory(type) ? upgrade : 0,
        solvents: weapon ? upgrade : 0,
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

    // Items across `jobs` that still cost tomes, twines, glazes or solvents
    function neededPieces(jobs: readonly string[]): (Materials & { job: string; slot: number })[] {
      return uniqueSlots(jobs, (job, slot) => {
        const cost = costOf(slot, statusOf(job, slot))
        return cost.tomes + cost.twines + cost.glazes + cost.solvents > 0
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
      return neededPieces(jobs).reduce(
        (sum, p) => ({
          tomes: sum.tomes + p.tomes,
          twines: sum.twines + p.twines,
          glazes: sum.glazes + p.glazes,
          solvents: sum.solvents + p.solvents,
        }),
        { tomes: 0, twines: 0, glazes: 0, solvents: 0 },
      )
    }

    // Sets exactly which slots `job` shares with each listed job; newly linked slots take on `job`'s statuses.
    // Throws so the link dialog can stay open on failure.
    async function saveLinks(job: string, wanted: Record<string, number[]>) {
      await apiFetch(`${base}/${job}/links`, { method: 'PUT', body: { links: wanted } })
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
        items.value = {}
        links.value = {}
        loaded.value = false
      },
    )

    return {
      slots,
      links,
      loading,
      load,
      ensureLoaded,
      statusOf,
      sourceOf,
      itemOf,
      hasUltimate,
      weaponItem,
      pieceOf,
      itemOptions,
      linkedOnSlot,
      isLinked,
      linkedWith,
      setStatus,
      setItem,
      setStatuses,
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

const definitions = new Map<number, ReturnType<typeof defineBisStore>>()

// Progress for one gear set: the default one (0, what the dashboard shows) or a custom set's id
export function useBisStore(setId = 0) {
  let define = definitions.get(setId)
  if (!define) definitions.set(setId, (define = defineBisStore(setId)))
  return define()
}

export type BisStore = ReturnType<typeof useBisStore>
