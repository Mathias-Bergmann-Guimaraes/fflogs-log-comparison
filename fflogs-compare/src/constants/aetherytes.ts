// Every aetheryte you can teleport to, by zone. Cities and one-aetheryte places with the same name as their
// zone have no zone. Used to find where a hunt train starts from the conductor's post.
const ZONES: Record<string, string[]> = {
  // Cities and other places that are their own zone
  '': [
    'Limsa Lominsa Lower Decks',
    "Wolves' Den Pier",
    'New Gridania',
    "Ul'dah - Steps of Nald",
    'The Gold Saucer',
    'Foundation',
    'Idyllshire',
    "Rhalgr's Reach",
    'Kugane',
    'The Doman Enclave',
    'Radz-at-Han',
    'The Crystarium',
    'Eulmore',
    "Revenant's Toll",
    'Old Sharlayan',
    'Tuliyollal',
    'Solution Nine',
  ],
  // La Noscea
  'Middle La Noscea': ['Summerford Farms'],
  'Lower La Noscea': ['Moraby Drydocks'],
  'Eastern La Noscea': ['Costa del Sol', 'Wineport'],
  'Western La Noscea': ['Swiftperch', 'Aleport'],
  'Upper La Noscea': ['Camp Bronze Lake'],
  'Outer La Noscea': ['Camp Overlook'],
  // The Black Shroud
  'Central Shroud': ['Bentbranch Meadows'],
  'East Shroud': ['The Hawthorne Hut'],
  'South Shroud': ['Quarrymill', 'Camp Tranquil'],
  'North Shroud': ['Fallgourd Float'],
  // Thanalan
  'Western Thanalan': ['Horizon'],
  'Central Thanalan': ['Black Brush Station'],
  'Eastern Thanalan': ['Camp Drybone'],
  'Southern Thanalan': ['Little Ala Mhigo', 'Forgotten Springs'],
  'Northern Thanalan': ['Camp Bluefog', 'Ceruleum Processing Plant'],
  // Coerthas, Abalathia's Spine, Dravania
  'Coerthas Central Highlands': ['Camp Dragonhead'],
  'Coerthas Western Highlands': ["Falcon's Nest"],
  'The Sea of Clouds': ['Camp Cloudtop', "Ok' Zundu"],
  'Azys Lla': ['Helix'],
  'The Dravanian Forelands': ['Tailfeather', 'Anyx Trine'],
  'The Churning Mists': ['Moghome', 'Zenith'],
  // Gyr Abania, Othard
  'The Fringes': ['Castrum Oriens', 'The Peering Stones'],
  'The Peaks': ['Ala Gannha', 'Ala Ghiri'],
  'The Lochs': ['Porta Praetoria', 'The Ala Mhigan Quarter'],
  'The Ruby Sea': ['Tamamizu', 'Onokoro'],
  Yanxia: ['Namai', 'The House of the Fierce'],
  'The Azim Steppe': ['Reunion', 'The Dawn Throne', 'Dhoro Iloh'],
  // Norvrandt
  Lakeland: ['Fort Jobb', 'The Ostall Imperative'],
  Kholusia: ['Stilltide', 'Wright', 'Tomra'],
  'Amh Araeng': ['Mord Souq', "The Inn at Journey's Head", 'Twine'],
  'Il Mheg': ['Lydha Lran', 'Pla Enni', 'Wolekdorf'],
  "The Rak'tika Greatwood": ['Slitherbough', 'Fanow'],
  'The Tempest': ['The Ondo Cups', 'The Macarenses Angle'],
  // Endwalker
  Labyrinthos: ['The Archeion', 'Sharlayan Hamlet', 'Aporia'],
  Thavnair: ['Yedlihmad', 'The Great Work', "Palaka's Stand"],
  Garlemald: ['Camp Broken Glass', 'Tertium'],
  'Mare Lamentorum': ['Sinus Lacrimarum', 'Bestways Burrow'],
  Elpis: ['Anagnorisis', 'The Twelve Wonders', 'Poieten Oikos'],
  'Ultima Thule': ['Reah Tahra', 'Abode of the Ea', 'Base Omicron'],
  // Dawntrail
  Urqopacha: ['Wachunpelo', "Worlar's Echo"],
  "Kozama'uka": ["Ok'hanu", 'Many Fires', 'Earthenshire', 'Dock Poga'],
  "Yak T'el": ["Iq Br'aax", 'Mamook'],
  Shaaloani: ['Hhusatahwi', 'Sheshenewezi Springs', 'Mehwahhetsoan'],
  'Heritage Found': ['Yyasulani Station', 'The Outskirts', 'Electrope Strike'],
  'Living Memory': ['Leynode Mnemo', 'Leynode Pyro', 'Leynode Aero'],
}

// Also everyday words: only matched with their capital letter, so "a new horizon" or "zenith" in chatter doesn't count
const COMMON_WORDS = new Set(['Foundation', 'Horizon', 'Helix', 'Zenith', 'Reunion', 'Twine', 'Wright'])

type Place = { name: string; zone: string | null }

// Curly apostrophes and spacing differ between keyboards; the pattern matches either
const pattern = (name: string) =>
  name
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/'/g, "['’]?\\s?")
    .replace(/ /g, '\\s+')
const matcher = (name: string) => new RegExp(`(?<![\\w'])${pattern(name)}(?![\\w])`, COMMON_WORDS.has(name) ? '' : 'i')

const AETHERYTES: (Place & { re: RegExp })[] = Object.entries(ZONES).flatMap(([zone, names]) =>
  names.map((name) => ({ name, zone: zone || null, re: matcher(name) })),
)
const ZONE_MATCHERS = Object.keys(ZONES)
  .filter(Boolean)
  .map((zone) => ({ zone, re: matcher(zone) }))

export type StartingPoint = { aetheryte: string | null; zone: string | null; instance: number | null }

// Posts read like "Heritage Found -> The Outskirts -> Instance 1" or "Labyrinthos - Aporia". An aetheryte in a zone
// the post names wins; otherwise the first aetheryte in the text, otherwise just the zone.
export function parseStartingPoint(text: string): StartingPoint | null {
  const at = (re: RegExp) => re.exec(text)?.index ?? -1
  const zones = ZONE_MATCHERS.map((z) => ({ ...z, index: at(z.re) }))
    .filter((z) => z.index >= 0)
    .sort((a, b) => a.index - b.index)
  const aetherytes = AETHERYTES.map((a) => ({ ...a, index: at(a.re) }))
    .filter((a) => a.index >= 0)
    .sort((a, b) => a.index - b.index)
  const inNamedZone = aetherytes.find((a) => a.zone && zones.some((z) => z.zone === a.zone))
  const aetheryte = inNamedZone ?? aetherytes[0]
  const instance = Number(/\b(?:instance|inst\.?)\s*#?\s*([1-6])\b/i.exec(text)?.[1]) || null

  if (aetheryte) return { aetheryte: aetheryte.name, zone: aetheryte.zone, instance }
  if (zones[0]) return { aetheryte: null, zone: zones[0].zone, instance }
  return null
}

// The expansion a place belongs to (2 = A Realm Reborn to 7 = Dawntrail), from its zone, or for a city from its name.
// "Old" A rank trains are pinged together, so this tells an ARR, Heavensward or Stormblood one apart by where it starts.
const ZONE_EXPANSIONS: [number, string[]][] = [
  [2, ['La Noscea', 'Shroud', 'Thanalan', 'Coerthas Central Highlands', 'Mor Dhona']],
  [3, ['Coerthas Western Highlands', 'The Sea of Clouds', 'Azys Lla', 'The Dravanian Forelands', 'The Churning Mists', 'The Dravanian Hinterlands']],
  [4, ['The Fringes', 'The Peaks', 'The Lochs', 'The Ruby Sea', 'Yanxia', 'The Azim Steppe']],
  [5, ['Lakeland', 'Kholusia', 'Amh Araeng', 'Il Mheg', "The Rak'tika Greatwood", 'The Tempest']],
  [6, ['Labyrinthos', 'Thavnair', 'Garlemald', 'Mare Lamentorum', 'Elpis', 'Ultima Thule']],
  [7, ['Urqopacha', "Kozama'uka", "Yak T'el", 'Shaaloani', 'Heritage Found', 'Living Memory']],
]
const CITY_EXPANSIONS: Record<string, number> = {
  'Limsa Lominsa Lower Decks': 2,
  "Wolves' Den Pier": 2,
  'New Gridania': 2,
  "Ul'dah - Steps of Nald": 2,
  'The Gold Saucer': 2,
  "Revenant's Toll": 2,
  Foundation: 3,
  Idyllshire: 3,
  "Rhalgr's Reach": 4,
  Kugane: 4,
  'The Doman Enclave': 4,
  'The Crystarium': 5,
  Eulmore: 5,
  'Radz-at-Han': 6,
  'Old Sharlayan': 6,
  Tuliyollal: 7,
  'Solution Nine': 7,
}

// Zones match on their region too ("Eastern La Noscea" is La Noscea)
export function expansionOfPlace(point: StartingPoint | null): number | null {
  if (!point) return null
  if (point.zone) return ZONE_EXPANSIONS.find(([, zones]) => zones.some((z) => point.zone!.includes(z)))?.[0] ?? null
  return point.aetheryte ? (CITY_EXPANSIONS[point.aetheryte] ?? null) : null
}
