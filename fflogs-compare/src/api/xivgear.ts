// Reads gear sets from xivgear.app links. Both its APIs allow cross-origin requests, so this runs in the browser.
import { EquipmentStatus, EquipmentType, type GearSource } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { gearItemIds, gearItemNames } from '@/constants/gearItems'
import { jobAbbreviations } from '@/constants/jobs'

const SHORTLINK_API = 'https://api.xivgear.app/shortlink'
const STATIC_BIS = 'https://staticbis.xivgear.app'

// xivgear's job abbreviations -> our job names
const jobsByAbbreviation: Record<string, string> = Object.fromEntries(Object.entries(jobAbbreviations).map(([job, abbr]) => [abbr, job]))

// xivgear's slot keys, in bisSlots order (a paladin's OffHand shield isn't tracked)
const xivgearSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight', 'Weapon'] as const

type XivgearItems = Partial<Record<string, { id: number }>>
type XivgearSet = { name?: string; items?: XivgearItems; isSeparator?: boolean; job?: string }
// A shared link is either one set or a whole sheet of them
type XivgearResponse = XivgearSet & { sets?: XivgearSet[] }

export type ImportedSet = { name: string; job: string | null; itemIds: (number | null)[] }
export type ImportedSheet = { name: string; sets: ImportedSet[]; preferredIndex: number }

// What a link points at: a saved set/sheet (shortlink) or one of xivgear's curated BiS sheets.
// Accepts xivgear.app/sl/<uuid>, xivgear.app/?page=sl|<uuid>, xivgear.app/?page=bis|sch|current, or a bare uuid.
function sourceUrl(link: string): { url: string; setIndex: number | null } {
  const text = link.trim()
  if (/^[0-9a-f-]{36}$/i.test(text)) return { url: `${SHORTLINK_API}/${text}`, setIndex: null }

  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    throw new Error("That isn't a link")
  }
  if (!/(^|\.)xivgear\.app$/.test(parsed.hostname)) throw new Error('Only xivgear.app links can be imported')

  const index = parsed.searchParams.get('onlySetIndex') ?? parsed.searchParams.get('selectedIndex')
  const setIndex = index !== null && /^\d+$/.test(index) ? Number(index) : null
  const page = parsed.searchParams.get('page')
  const parts = (page ? page.split('|') : parsed.pathname.split('/')).filter(Boolean).map(decodeURIComponent)

  const [kind, ...rest] = parts
  if (kind === 'sl' && rest[0]) return { url: `${SHORTLINK_API}/${rest[0]}`, setIndex }
  if (kind === 'bis' && rest.length >= 2) return { url: `${STATIC_BIS}/${rest.join('/')}.json`, setIndex }
  throw new Error("That xivgear link doesn't point at a saved set or BiS sheet")
}

const itemIdsOf = (items: XivgearItems = {}) => xivgearSlots.map((slot) => items[slot]?.id ?? null)

export async function fetchXivgearSheet(link: string): Promise<ImportedSheet> {
  const { url, setIndex } = sourceUrl(link)
  const res = await fetch(url)
  if (res.status === 404) throw new Error("xivgear couldn't find that set. Check the link")
  if (!res.ok) throw new Error(`xivgear returned ${res.status}`)
  const data = (await res.json()) as XivgearResponse

  const sheetJob = (data.job && jobsByAbbreviation[data.job]) ?? null
  const toSet = (set: XivgearSet, fallbackName: string): ImportedSet => ({
    name: set.name || fallbackName,
    job: (set.job && jobsByAbbreviation[set.job]) ?? sheetJob,
    itemIds: itemIdsOf(set.items),
  })

  // Separators are headings between sets in the sheet, not sets. Keep the original index so ?onlySetIndex= still points right.
  const sets = data.sets ? data.sets.map((set, i) => ({ set, i })).filter(({ set }) => !set.isSeparator) : [{ set: data as XivgearSet, i: 0 }]
  if (!sets.length) throw new Error('That sheet has no gear sets')

  const imported = sets.map(({ set }, n) => toSet(set, `Set ${n + 1}`))
  const preferred = setIndex === null ? -1 : sets.findIndex(({ i }) => i === setIndex)
  return { name: data.name || imported[0]!.name, sets: imported, preferredIndex: Math.max(preferred, 0) }
}

// What the set means for one slot: a piece we track (raid or tome, or the relic or trial weapon), nothing (empty slot),
// or an item this tier's gear doesn't include (crafted, an older tier...)
export type SlotImport = { kind: 'piece'; source: GearSource } | { kind: 'empty' } | { kind: 'other'; itemId: number }

export function slotImports(job: string, itemIds: readonly (number | null)[]): SlotImport[] {
  return bisSlots.map((type: EquipmentType, slot) => {
    const id = itemIds[slot]
    if (!id) return { kind: 'empty' }
    const source = Object.entries(gearItemIds[job]?.[type] ?? {}).find(([, pieceId]) => pieceId === id)?.[0] as GearSource | undefined
    return source ? { kind: 'piece', source } : { kind: 'other', itemId: id }
  })
}

// The status a slot starts on when its piece comes from `source`
export function startingStatus(source: GearSource): EquipmentStatus {
  const statuses: Record<GearSource, EquipmentStatus> = {
    raid: EquipmentStatus.RAID,
    tome: EquipmentStatus.TOME,
    dungeon: EquipmentStatus.DUNGEON,
    relic: EquipmentStatus.RELIC,
    trial: EquipmentStatus.TRIAL,
    ultimate: EquipmentStatus.ULTIMATE,
  }
  return statuses[source]
}

// The slot's new status: progress is kept while the piece stays the same, otherwise it starts over on the new piece
export function importedStatus(current: EquipmentStatus, currentSource: GearSource, source: GearSource): EquipmentStatus {
  return currentSource === source ? current : startingStatus(source)
}

// Where an item from another tier comes from, as far as its name tells: upgraded tome gear is "Augmented",
// and everything else is taken for raid gear (the import dialog spots a custom set's dungeon piece itself)
export const guessSource = (itemName: string | undefined): GearSource => (itemName?.startsWith('Augmented') ? 'tome' : 'raid')

// Names (with item level) of items gearItems.ts doesn't know, from XIVAPI. Best effort: missing names just aren't shown.
export async function fetchItemNames(ids: readonly number[]): Promise<Record<number, string>> {
  const unknown = [...new Set(ids)].filter((id) => !gearItemNames[id])
  if (!unknown.length) return {}
  try {
    const params = new URLSearchParams({ rows: unknown.join(','), fields: 'Name,LevelItem.value' })
    const res = await fetch(`https://v2.xivapi.com/api/sheet/Item?${params}`)
    if (!res.ok) return {}
    const data = (await res.json()) as { rows: { row_id: number; fields: { Name: string; LevelItem: { value: number } } }[] }
    return Object.fromEntries(data.rows.map((r) => [r.row_id, `${r.fields.Name} (i${r.fields.LevelItem.value})`]))
  } catch {
    return {}
  }
}
