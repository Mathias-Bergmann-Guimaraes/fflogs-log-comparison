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
