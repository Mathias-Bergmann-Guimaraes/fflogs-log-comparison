import { defineStore } from 'pinia'
import { ref } from 'vue'
import { EquipmentType, type GearSource } from '@/types/EquipmentType'
import { gearItemNames } from '@/constants/gearItems'
import { jobAbbreviations } from '@/constants/jobs'
import { isUltimateWeapon, ultimateWithin } from '@/constants/ultimates'

// Gear from any tier, looked up on XIVAPI for custom gear sets: what each job can wear in a set's item level range,
// and the details of items pinned to a slot. Cached for the session; nothing here is saved.

const API = 'https://v2.xivapi.com/api'
const FIELDS = 'Name,LevelItem.value,EquipSlotCategory.value,Icon'

// EquipSlotCategory row -> EquipmentType; same as scripts/gear-icons.ts. Weapons are one-handed (1) or two-handed (13);
// a paladin's shield (2) isn't tracked.
const typeOfCategory: Record<number, EquipmentType> = {
  1: EquipmentType.WEAPON,
  13: EquipmentType.WEAPON,
  3: EquipmentType.HEAD,
  4: EquipmentType.BODY,
  5: EquipmentType.HANDS,
  7: EquipmentType.LEGS,
  8: EquipmentType.FEET,
  9: EquipmentType.EARRINGS,
  10: EquipmentType.NECKLACE,
  11: EquipmentType.BRACELETS,
  12: EquipmentType.RING,
}

export type CatalogItem = { id: number; name: string; ilvl: number; type: EquipmentType | undefined; icon: string }
type Row = {
  row_id: number
  fields: { Name: string; LevelItem: { value: number }; EquipSlotCategory: { value: number }; Icon: { path_hr1: string } }
}

// This tier's items have local icons (public/gear/); anything else comes from XIVAPI
const iconOf = (id: number, path: string) => (gearItemNames[id] ? `/gear/${id}.png` : `${API}/asset?${new URLSearchParams({ path, format: 'png' })}`)

const toItem = ({ row_id, fields }: Row): CatalogItem => ({
  id: row_id,
  name: fields.Name,
  ilvl: fields.LevelItem.value,
  type: typeOfCategory[fields.EquipSlotCategory.value],
  icon: iconOf(row_id, fields.Icon.path_hr1),
})

// The words a set of gear names start with: "Grand Champion's" for "Grand Champion's Headgear of Fending", "... Jacket of Fending"
function seriesOf(names: readonly string[]): string {
  const words = names.map((name) => name.split(' '))
  const common: string[] = []
  for (const [i, word] of (words[0] ?? []).entries()) {
    if (!words.every((w) => w[i] === word)) break
    common.push(word)
  }
  return common.join(' ')
}

const rangeKey = (job: string, min: number, max: number) => `${job}:${min}:${max}`

export const useItemCatalogStore = defineStore('itemCatalog', () => {
  const items = ref<Record<number, CatalogItem>>({})
  // Item ids per job + range; missing while it loads, or if it failed
  const ranges = ref<Record<string, number[]>>({})
  const pending = new Map<string, Promise<void>>()

  function remember(rows: Row[]) {
    for (const row of rows) items.value[row.row_id] = toItem(row)
  }

  // Every weapon, armour piece and accessory the job can wear within [min, max]. Failures are logged, not thrown:
  // the slots just fall back to the generic icons.
  function loadRange(job: string, min: number, max: number): Promise<void> {
    const key = rangeKey(job, min, max)
    const abbreviation = jobAbbreviations[job]
    if (ranges.value[key] || !abbreviation) return Promise.resolve()
    if (!pending.has(key)) {
      const load = async () => {
        const ids: number[] = []
        let url: string | null =
          `${API}/search?` +
          new URLSearchParams({
            sheets: 'Item',
            query: `+ClassJobCategory.${abbreviation}=true +LevelItem>=${min} +LevelItem<=${max} +EquipSlotCategory>0`,
            fields: FIELDS,
            limit: '500',
          })
        while (url) {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`XIVAPI returned ${res.status}`)
          const page = (await res.json()) as { results: Row[]; next?: string }
          const rows = page.results.filter((r) => typeOfCategory[r.fields.EquipSlotCategory.value] !== undefined)
          remember(rows)
          ids.push(...rows.map((r) => r.row_id))
          url = page.next ? `${API}/search?cursor=${page.next}` : null
        }
        ranges.value[key] = ids
      }
      pending.set(
        key,
        load()
          .catch((err) => console.error(`Couldn't load ${job}'s gear for i${min}-${max}`, err))
          .finally(() => pending.delete(key)),
      )
    }
    return pending.get(key)!
  }

  // Details for items not seen yet (pinned or imported ones, a relic series' weapons). Best effort, like loadRange.
  // XIVAPI returns 100 rows unless told otherwise; a relic series asks for up to 240.
  async function ensureItems(ids: readonly number[]) {
    const unknown = [...new Set(ids)].filter((id) => !items.value[id])
    if (!unknown.length) return
    try {
      const res = await fetch(`${API}/sheet/Item?${new URLSearchParams({ rows: unknown.join(','), fields: FIELDS, limit: '500' })}`)
      if (!res.ok) throw new Error(`XIVAPI returned ${res.status}`)
      remember(((await res.json()) as { rows: Row[] }).rows)
    } catch (err) {
      console.error("Couldn't load item details", err)
    }
  }

  // What the job can wear in this slot within the range, best first; empty until loadRange is done
  function itemsFor(job: string, min: number, max: number, type: EquipmentType): CatalogItem[] {
    return (ranges.value[rangeKey(job, min, max)] ?? [])
      .map((id) => items.value[id]!)
      .filter((item) => item.type === type)
      .sort((a, b) => b.ilvl - a.ilvl || a.id - b.id)
  }

  // The range's raid, tome or dungeon piece. Raid and tome work the way scripts/gear-icons.ts finds this tier's: the tome
  // piece is the best "Augmented" item, and the raid piece the other item at that item level. The dungeon piece is the
  // one at the top of the range, the encounter's own item level: each ultimate's sync matches the dungeon gear released
  // with it (Voidmoon at TOP's i635, Mistic Memory at FRU's i735). Relic armour ("... +2") can share that item level,
  // so it's skipped. Nothing at that level (DMU's i795 has no gear): no automatic piece, pin one instead.
  // Weapons sit above the armour's item level, so they go by name instead (see weaponPiece).
  function autoPiece(job: string, min: number, max: number, type: EquipmentType, source: GearSource): CatalogItem | undefined {
    if (type === EquipmentType.WEAPON) return weaponPiece(job, min, max, source)
    const options = itemsFor(job, min, max, type)
    if (source === 'dungeon') return options.find((i) => i.ilvl === max && !/\+\d$/.test(i.name))
    const tome = options.find((i) => i.name.startsWith('Augmented'))
    if (source === 'tome') return tome
    return options.find((i) => !i.name.startsWith('Augmented') && (!tome || i.ilvl === tome.ilvl))
  }

  // The raid and tome weapons share their armour's names ("Grand Champion's Sawback", "... Headgear of Fending"), so
  // they're the best weapon starting with the head and body pieces' common words. The ultimate's is the one ultimates.ts
  // describes, for the newest ultimate in the range. Relic and trial weapons follow no such pattern: no automatic piece,
  // pin one instead.
  function weaponPiece(job: string, min: number, max: number, source: GearSource): CatalogItem | undefined {
    if (source === 'ultimate') {
      const ultimate = ultimateWithin(min, max)
      return ultimate && itemsFor(job, min, max, EquipmentType.WEAPON).find((i) => isUltimateWeapon(ultimate, i.name, i.ilvl))
    }
    if (source !== 'raid' && source !== 'tome') return undefined
    const armour = [EquipmentType.HEAD, EquipmentType.BODY].map((type) => autoPiece(job, min, max, type, source))
    if (!armour.every(Boolean)) return undefined
    const series = seriesOf(armour.map((piece) => piece!.name))
    return series ? itemsFor(job, min, max, EquipmentType.WEAPON).find((i) => i.name.startsWith(`${series} `)) : undefined
  }

  return { items, loadRange, ensureItems, itemsFor, autoPiece }
})
