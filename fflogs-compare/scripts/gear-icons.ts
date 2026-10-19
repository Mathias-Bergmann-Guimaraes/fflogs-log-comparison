// Fetches the current tier's raid and tome gear for every job from XIVAPI (plus the relic, extreme trial and ultimate weapons),
// saves the icons to public/gear/ and writes src/constants/gearItems.ts. Run once per tier: npm run gear-icons
import { mkdir, writeFile } from 'node:fs/promises'
import { allJobs } from '../src/constants/gearSharing.ts'
import { isUltimateWeapon, ultimates } from '../src/constants/ultimates.ts'

const API = 'https://v2.xivapi.com/api'
// Anything below this is an older tier; it only keeps the result pages short
const MIN_ITEM_LEVEL = 700

const abbreviations: Record<string, string> = {
  Paladin: 'PLD',
  Warrior: 'WAR',
  DarkKnight: 'DRK',
  Gunbreaker: 'GNB',
  WhiteMage: 'WHM',
  Scholar: 'SCH',
  Astrologian: 'AST',
  Sage: 'SGE',
  Monk: 'MNK',
  Dragoon: 'DRG',
  Ninja: 'NIN',
  Samurai: 'SAM',
  Reaper: 'RPR',
  Viper: 'VPR',
  Bard: 'BRD',
  Machinist: 'MCH',
  Dancer: 'DNC',
  BlackMage: 'BLM',
  Summoner: 'SMN',
  RedMage: 'RDM',
  Pictomancer: 'PCT',
}

// EquipSlotCategory row per armour/accessory EquipmentType, in enum order (head ... ring)
const slotCategories = [3, 4, 5, 7, 8, 9, 10, 11, 12]
// The weapon (EquipmentType.WEAPON, last): one-handed main hand, or two-handed. A paladin's shield isn't tracked.
const weaponCategories = [1, 13]

// The relic and extreme trial weapons don't follow the raid and tome gear's names, so they're set by hand each tier
// ("Phantom Gunblade Occultum", "Gunblade of Naught"); the best match wins
const isRelic = (name: string) => name.startsWith('Phantom ')
const isTrial = (name: string) => name.endsWith(' of Naught')

type Item = { id: number; name: string; itemLevel: number; slotCategory: number; iconPath: string }
type SearchResult = {
  row_id: number
  fields: { Name: string; LevelItem: { value: number }; EquipSlotCategory: { value: number }; Icon: { path_hr1: string } }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return (await res.json()) as T
}

async function equipmentFor(abbreviation: string): Promise<Item[]> {
  const items: Item[] = []
  let url: string | null =
    `${API}/search?` +
    new URLSearchParams({
      sheets: 'Item',
      query: `+ClassJobCategory.${abbreviation}=true +LevelItem>=${MIN_ITEM_LEVEL} +EquipSlotCategory>0`,
      fields: 'Name,LevelItem.value,EquipSlotCategory.value,Icon',
      limit: '500',
    })
  while (url) {
    const page: { results: SearchResult[]; next?: string } = await getJson(url)
    for (const { row_id, fields } of page.results) {
      items.push({
        id: row_id,
        name: fields.Name,
        itemLevel: fields.LevelItem.value,
        slotCategory: fields.EquipSlotCategory.value,
        iconPath: fields.Icon.path_hr1,
      })
    }
    url = page.next ? `${API}/search?cursor=${page.next}` : null
  }
  return items
}

// The top item level in a slot has exactly two pieces: the raid one and the upgraded ("Augmented") tome one
function raidAndTome(job: string, items: Item[], slotCategory: number): [Item, Item] {
  const inSlot = items.filter((i) => i.slotCategory === slotCategory)
  const top = Math.max(...inSlot.map((i) => i.itemLevel))
  const best = inSlot.filter((i) => i.itemLevel === top)
  const raid = best.filter((i) => !i.name.startsWith('Augmented'))
  const tome = best.filter((i) => i.name.startsWith('Augmented'))
  if (raid.length !== 1 || tome.length !== 1) {
    throw new Error(
      `${job}, slot category ${slotCategory}: expected one raid and one tome piece at ${top}, got ${best.map((i) => i.name).join(', ')}`,
    )
  }
  return [raid[0]!, tome[0]!]
}

// The words a set of gear names start with: "Grand Champion's" for "Grand Champion's Headgear of Fending", "... Jacket of Fending"
function seriesOf(pieces: readonly Item[]): string {
  const words = pieces.map((p) => p.name.split(' '))
  const common: string[] = []
  for (const [i, word] of words[0]!.entries()) {
    if (!words.every((w) => w[i] === word)) break
    common.push(word)
  }
  return common.join(' ') + ' '
}

// The best of the job's weapons that `matches`
function bestWeapon(items: Item[], matches: (item: Item) => boolean): Item | undefined {
  return items.filter((i) => weaponCategories.includes(i.slotCategory) && matches(i)).sort((a, b) => b.itemLevel - a.itemLevel)[0]
}

type Source = 'raid' | 'tome' | 'relic' | 'trial' | 'ultimate'

const names = new Map<number, string>()
const icons = new Map<number, string>()
const ids: Record<string, Partial<Record<Source, number>>[]> = {}

for (const job of allJobs) {
  const items = await equipmentFor(abbreviations[job]!)
  const pairs = slotCategories.map((category) => raidAndTome(job, items, category))
  // The weapons share the armour's names: the raid one "Grand Champion's ...", the tome one "Augmented Bygone Brass ..."
  const raidSeries = seriesOf(pairs.map(([raid]) => raid))
  const tomeSeries = seriesOf(pairs.map(([, tome]) => tome))
  const weapon: Partial<Record<Source, Item>> = {
    raid: bestWeapon(items, (i) => i.name.startsWith(raidSeries)),
    tome: bestWeapon(items, (i) => i.name.startsWith(tomeSeries)),
    relic: bestWeapon(items, (i) => isRelic(i.name)),
    trial: bestWeapon(items, (i) => isTrial(i.name)),
  }
  // Not every tier has an ultimate: when it does, its sync is the raid weapon's item level
  const ultimate = ultimates.find((u) => u.sync === weapon.raid?.itemLevel)
  if (ultimate?.weapon) weapon.ultimate = bestWeapon(items, (i) => isUltimateWeapon(ultimate, i.name, i.itemLevel))
  const missing = Object.entries(weapon).filter(([, item]) => !item)
  if (missing.length) console.warn(`${job}: no ${missing.map(([source]) => source).join(', ')} weapon found`)

  for (const item of [...pairs.flat(), ...Object.values(weapon)]) {
    if (!item) continue
    names.set(item.id, item.name)
    icons.set(item.id, item.iconPath)
  }
  ids[job] = [
    ...pairs.map(([raid, tome]) => ({ raid: raid.id, tome: tome.id })),
    Object.fromEntries(Object.entries(weapon).flatMap(([source, item]) => (item ? [[source, item.id]] : []))),
  ]
  console.log(`${job}: ${Object.keys(weapon).length - missing.length} weapons`)
}

await mkdir('public/gear', { recursive: true })
for (const [id, path] of icons) {
  const res = await fetch(`${API}/asset?${new URLSearchParams({ path, format: 'png' })}`)
  if (!res.ok) throw new Error(`Icon for item ${id}: ${res.status}`)
  await writeFile(`public/gear/${id}.png`, Buffer.from(await res.arrayBuffer()))
}
console.log(`${icons.size} icons saved to public/gear/`)

const sortedNames = [...names].sort(([a], [b]) => a - b)
const source = `// Generated by scripts/gear-icons.ts (npm run gear-icons), don't edit by hand.
// Icons are public/gear/<id>.png, 80px.
import type { GearSource } from '@/types/EquipmentType'

export const gearItemNames: Record<number, string> = {
${sortedNames.map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`).join('\n')}
}

// Item id per job and EquipmentType, by where the piece comes from. Only the weapon has a relic and trial one.
export const gearItemIds: Record<string, readonly Partial<Record<GearSource, number>>[]> = {
${allJobs.map((job) => `  ${job}: ${JSON.stringify(ids[job])},`).join('\n')}
}
`
await writeFile('src/constants/gearItems.ts', source)
console.log('Wrote src/constants/gearItems.ts')
