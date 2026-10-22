import type { HuntSRankMessage } from '@/types/hunts'
import { parseWorld, type Currency, type DataCenterName } from './trains'

// S ranks are reported by Faloop's bot: "[ Lich ]  The Garlok［Garlok］" with the details in an embed:
//   ### _ _🌍  Lich
//   ## <:smob:…>  The Garlok ［Garlok］            (<:ssmob:…> for an SS rank)
//   ### _ _<:2x:…>  Eastern La Noscea ［…］ ［…］  (the emoji is the expansion: 2x ARR to 7x Dawntrail)
//    <:aetheryte:…>   Wineport ［…］［…］  ⇒  ❌ **`17.0, 33.9`**   (one line per possible spawn point)
// with the spotter in the footer ("📢  Name", or "Faloop.app" when nobody is named) and the map as the image.

export type ExpansionKey = 2 | 3 | 4 | 5 | 6 | 7

// Ant preset colours, shared with the A rank trains' tags (TRAIN_TYPES in trains.ts, where Old is red like Stormblood)
export const EXPANSIONS: Record<ExpansionKey, { label: string; name: string; color: string }> = {
  2: { label: '2.0', name: 'A Realm Reborn', color: 'blue' },
  3: { label: '3.0', name: 'Heavensward', color: 'cyan' },
  4: { label: '4.0', name: 'Stormblood', color: 'red' },
  5: { label: '5.0', name: 'Shadowbringers', color: 'purple' },
  6: { label: '6.0', name: 'Endwalker', color: 'geekblue' },
  7: { label: '7.0', name: 'Dawntrail', color: 'green' },
}

// What one S (or SS) rank pays (https://ffxiv.consolegameswiki.com/wiki/The_Hunt). SS ranks only exist from
// Shadowbringers on. Mathematics and Mnemonics only drop on a level-capped job, so those are the most it can give.
const S_REWARDS: Record<ExpansionKey, Partial<Record<Currency, number>>> = {
  2: { 'Allied Seals': 100, Poetics: 100, Mathematics: 30 },
  3: { 'Centurio Seals': 100, Poetics: 100, Mathematics: 30 },
  4: { 'Centurio Seals': 100, Poetics: 100, Mathematics: 30 },
  5: { 'Sacks of Nuts': 100, Poetics: 100, Mathematics: 30 },
  6: { 'Sacks of Nuts': 100, Poetics: 100, Mathematics: 30 },
  7: { 'Sacks of Nuts': 100, Poetics: 100, Mathematics: 80, Mnemonics: 30 },
}
const SS_REWARDS: Partial<Record<ExpansionKey, Partial<Record<Currency, number>>>> = {
  5: { 'Sacks of Nuts': 400, Poetics: 200, Mathematics: 50 },
  6: { 'Sacks of Nuts': 400, Poetics: 200, Mathematics: 50 },
  7: { 'Sacks of Nuts': 400, Poetics: 200, Mathematics: 100, Mnemonics: 50 },
}

// aetheryte: the closest one (an aethernet shard in a city); coords: the map flag, "17.0, 33.9"
export type SpawnPoint = { aetheryte: string | null; coords: string | null }

export type SRank = {
  id: string
  world: string
  dc: DataCenterName
  mark: string
  ss: boolean
  expansion: ExpansionKey | null
  zone: string | null
  spots: SpawnPoint[]
  spotter: string | null
  image: string | null
  spottedAt: number
}

// The feed never says when one dies, so an S rank counts as up this long after it's reported. The current expansion's
// draw a crowd that takes a few minutes to gather; older ones die almost as soon as they're called. One of unknown
// expansion gets the longer time, so it isn't hidden too soon.
export const LATEST_EXPANSION: ExpansionKey = 7
const LATEST_UP_MS = 5 * 60_000
const OLDER_UP_MS = 2 * 60_000

export const upMs = (sRank: SRank) => (sRank.expansion && sRank.expansion < LATEST_EXPANSION ? OLDER_UP_MS : LATEST_UP_MS)

export const isUp = (sRank: SRank, now: number) => now < sRank.spottedAt + upMs(sRank)

// English only: Faloop adds the French and German names in ［full-width brackets］, and custom emojis are dropped
const english = (text: string) =>
  text
    .replace(/<a?:\w+:\d+>/g, ' ')
    .split('［')[0]!
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || null

export function parseSRank(message: HuntSRankMessage): SRank | null {
  const place = parseWorld(message.content)
  if (!place) return null
  const embed = message.embeds[0]
  const lines = embed?.description?.split('\n') ?? []

  const markLine = lines.find((l) => /<:s{1,2}mob:/.test(l))
  // Without an embed the mark is still in the content, after the world: "[ Lich ]  The Garlok［Garlok］"
  const mark = english(markLine ?? message.content.split('\n')[0]!.replace(/^\s*\[[^\]]*\]/, ''))
  if (!mark) return null

  const zoneLine = lines.find((l) => /<:\dx:\d+>/.test(l))
  const digit = Number(zoneLine && /<:(\d)x:\d+>/.exec(zoneLine)?.[1])

  const spots = lines
    .filter((l) => l.includes('⇒'))
    .map((l) => {
      const [before, after] = l.split('⇒')
      return { aetheryte: english(before!), coords: /`\s*([\d.]+\s*,\s*[\d.]+)\s*`/.exec(after ?? '')?.[1] ?? null }
    })

  const footer = embed?.footer?.trim()
  return {
    id: message.id,
    ...place,
    mark,
    ss: !!markLine?.includes('<:ssmob:'),
    expansion: digit in EXPANSIONS ? (digit as ExpansionKey) : null,
    zone: zoneLine ? english(zoneLine) : null,
    spots,
    spotter: footer?.startsWith('📢') ? footer.replace('📢', '').trim() || null : null,
    image: embed?.image ?? embed?.thumbnail ?? null,
    spottedAt: message.createdAt,
  }
}

// Reposts of the same mark on the same world (a corrected spot) are folded into the newest one. Newest first in and out.
// Longer than it shows as up: a repost a while later is still the same spawn (an S rank respawns after hours).
const SAME_SPAWN_MS = 20 * 60_000

export function dedupeSRanks(sRanks: SRank[]): SRank[] {
  const kept: SRank[] = []
  for (const s of sRanks) {
    if (!kept.some((k) => k.world === s.world && k.mark === s.mark && Math.abs(k.spottedAt - s.spottedAt) < SAME_SPAWN_MS)) kept.push(s)
  }
  return kept
}

// Unknown expansion: nothing, rather than a guess
export function sRankRewards(sRank: SRank): { currency: Currency; amount: number }[] {
  if (!sRank.expansion) return []
  const table = (sRank.ss && SS_REWARDS[sRank.expansion]) || S_REWARDS[sRank.expansion]
  return Object.entries(table).map(([currency, amount]) => ({ currency: currency as Currency, amount: amount! }))
}
