import type { HuntPing, HuntTrainMessage } from '@/types/hunts'
import { parseStartingPoint, type StartingPoint } from '@/constants/aetherytes'

// EU worlds, in the order the Lodestone lists them
export const DATA_CENTERS = [
  { name: 'Light', worlds: ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'] },
  { name: 'Chaos', worlds: ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan'] },
] as const

export type DataCenterName = (typeof DATA_CENTERS)[number]['name']

const WORLDS = new Map<string, { world: string; dc: DataCenterName }>(
  DATA_CENTERS.flatMap((dc) => dc.worlds.map((world) => [world.toLowerCase(), { world, dc: dc.name }] as const)),
)
const WORLD_WORD_RE = new RegExp(`\\b(${[...WORLDS.keys()].join('|')})\\b`, 'i')

// A trains are pinged per expansion. The hunt server's roles are only known by id, so a ping counts as one of these
// once the user names it (Name pings on the A-Rank page) with the key or one of the aliases, e.g. "7.0" or "Dawntrail".
export type TrainTypeKey = '7.0' | '6.0' | '5.0' | 'old'

export const TRAIN_TYPES: { key: TrainTypeKey; label: string; expansion: string; aliases: string[] }[] = [
  { key: '7.0', label: '7.0', expansion: 'Dawntrail', aliases: ['7.0', '7', 'dt', 'dawntrail'] },
  { key: '6.0', label: '6.0', expansion: 'Endwalker', aliases: ['6.0', '6', 'ew', 'endwalker'] },
  { key: '5.0', label: '5.0', expansion: 'Shadowbringers', aliases: ['5.0', '5', 'shb', 'shadowbringers'] },
  { key: 'old', label: 'Old', expansion: 'ARR to Stormblood', aliases: ['old', 'older', 'legacy', 'arr', 'hw', 'sb', '4.0', 'stormblood'] },
]

export function trainTypeOfLabel(label: string | undefined): TrainTypeKey | null {
  const l = label?.trim().toLowerCase()
  if (!l) return null
  return TRAIN_TYPES.find((t) => t.aliases.includes(l) || l.includes(t.expansion.toLowerCase()))?.key ?? null
}

export type Train = {
  id: string
  world: string
  dc: DataCenterName
  types: TrainTypeKey[]
  pings: HuntPing[]
  // The <t:…> time in the post ("starting in 10 minutes"), or when it was posted if there is none
  startsAt: number
  // When it counts as over: see RUNNING_MS
  endsAt: number
  postedAt: number
  conductor: string | null
  start: StartingPoint | null
  content: string
}

// Conductors post "**[Twintania]** Hunt train starting <t:…:R> … (Conductor: [Shiva] Name)". The train's world is
// the first bracketed world; the conductor's home world comes later. Without brackets, the first world mentioned.
export function parseWorld(content: string) {
  for (const [, name] of content.matchAll(/\[\s*([a-z]+)\s*\]/gi)) {
    const found = WORLDS.get(name!.toLowerCase())
    if (found) return found
  }
  const word = WORLD_WORD_RE.exec(content)?.[1]
  return word ? WORLDS.get(word.toLowerCase())! : null
}

// A start time more than this far from the post is a typo or a different timestamp, not the train's start
const MAX_START_OFFSET_MS = 2 * 24 * 3_600_000

// The train's start, and whether the post gave one (otherwise it's the posting time)
export function parseStart(content: string, postedAt: number) {
  const unix = /<t:(\d+)(?::[tTdDfFR])?>/.exec(content)?.[1]
  const ms = unix ? Number(unix) * 1000 : NaN
  return Number.isFinite(ms) && Math.abs(ms - postedAt) <= MAX_START_OFFSET_MS ? { at: ms, given: true } : { at: postedAt, given: false }
}

export function parseConductor(content: string) {
  const name = /conductor\s*:\s*(?:\[[^\]]*\]\s*)?([^)\n]+)/i.exec(content.replace(/[*_`]/g, ''))?.[1]
  return name?.replace(/[.\s]+$/, '').trim() || null
}

export function parseTrain(message: HuntTrainMessage, labels: Record<string, string>): Train | null {
  const place = parseWorld(message.content)
  if (!place) return null
  const types = [...new Set(message.pings.map((ping) => trainTypeOfLabel(labels[ping])).filter((t) => t !== null))]
  const start = parseStart(message.content, message.createdAt)
  return {
    id: message.id,
    ...place,
    types,
    pings: message.pings,
    startsAt: start.at,
    endsAt: start.at + (start.given ? RUNNING_MS : RUNNING_UNTIMED_MS),
    postedAt: message.createdAt,
    conductor: parseConductor(message.content),
    // Without links and mentions, so an image id or role number can't look like a place
    start: parseStartingPoint(message.content.replace(/https?:\/\/\S+|<[^>]+>/g, ' ')),
    content: message.content,
  }
}

// Follow-up posts for the same train ("starting now", a corrected time) are folded into one
const SAME_TRAIN_MS = 45 * 60_000

// Newest first in, newest first out
export function dedupeTrains(trains: Train[]): Train[] {
  const kept: Train[] = []
  for (const train of trains) {
    const duplicate = kept.some(
      (k) =>
        k.world === train.world &&
        Math.abs(k.startsAt - train.startsAt) < SAME_TRAIN_MS &&
        (k.types.length === 0 || train.types.length === 0 || k.types.some((t) => train.types.includes(t))),
    )
    if (!duplicate) kept.push(train)
  }
  return kept
}

// --- Analysis ---

// A train counts as running this long after its start. A post without a start time is usually sent a while
// before the train leaves, so that counts from the post and runs longer.
export const RUNNING_MS = 15 * 60_000
export const RUNNING_UNTIMED_MS = 30 * 60_000

// Running or still to come
export const isActive = (train: Train, now: number) => now < train.endsAt

// A ranks respawn 3 to 6 hours after they die. A train kills all 12 of an expansion's A ranks on a world, so the next
// one there can't start before 3 hours after it ended, gets likelier towards 6 hours, and from then on can start anytime.
export const RESPAWN_MIN_MS = 3 * 3_600_000
export const RESPAWN_MAX_MS = 6 * 3_600_000

export type Respawn =
  | { phase: 'unseen' | 'open' | 'announced' | 'running' }
  | { phase: 'cooldown'; opensAt: number; fullAt: number }
  // progress: how far through the 3 to 6 hour window, 0 to 1
  | { phase: 'window'; opensAt: number; fullAt: number; progress: number }

export function respawnState(last: Train | null, now: number): Respawn {
  if (!last) return { phase: 'unseen' }
  if (now < last.startsAt) return { phase: 'announced' }
  const endedAt = last.endsAt
  if (now < endedAt) return { phase: 'running' }
  const opensAt = endedAt + RESPAWN_MIN_MS
  const fullAt = endedAt + RESPAWN_MAX_MS
  if (now < opensAt) return { phase: 'cooldown', opensAt, fullAt }
  if (now < fullAt) return { phase: 'window', opensAt, fullAt, progress: (now - opensAt) / (fullAt - opensAt) }
  return { phase: 'open' }
}

// A train can start there now (respawned or partly respawned)
export const canStart = (r: Respawn) => r.phase === 'unseen' || r.phase === 'open' || r.phase === 'window'

export const lastKey =(world: string, type: TrainTypeKey) => `${world}|${type}`

// Latest train per world and type; an announced train that hasn't started yet counts as the latest
export function lastTrains(trains: Train[]): Map<string, Train> {
  const last = new Map<string, Train>()
  for (const train of trains) {
    for (const type of train.types) {
      const key = lastKey(train.world, type)
      if ((last.get(key)?.startsAt ?? -Infinity) < train.startsAt) last.set(key, train)
    }
  }
  return last
}

const median = (values: number[]) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

// Typical time between two trains of a type on the same world, pooled over all worlds.
// Needs a few gaps before it means anything, so null until then.
export const MIN_GAPS = 3

export function typicalGap(trains: Train[], type: TrainTypeKey): number | null {
  const byWorld = new Map<string, number[]>()
  for (const train of trains) {
    if (!train.types.includes(type)) continue
    byWorld.set(train.world, [...(byWorld.get(train.world) ?? []), train.startsAt])
  }
  const gaps: number[] = []
  for (const times of byWorld.values()) {
    times.sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) gaps.push(times[i]! - times[i - 1]!)
  }
  return gaps.length >= MIN_GAPS ? median(gaps) : null
}

export type WorldStanding = {
  world: string
  dc: DataCenterName
  last: Train | null
  // Since the last train started; null when none was seen (older than anything tracked)
  elapsed: number | null
  respawn: Respawn
}

// Worlds of one DC, the one most likely to run the type next first: never seen, then longest since the last train.
// Longest ago is also furthest through respawning, so this runs open, in the window, cooling down, running, announced.
export function standings(last: Map<string, Train>, dc: (typeof DATA_CENTERS)[number], type: TrainTypeKey, now: number): WorldStanding[] {
  return dc.worlds
    .map((world) => {
      const train = last.get(lastKey(world, type)) ?? null
      return { world, dc: dc.name, last: train, elapsed: train ? now - train.startsAt : null, respawn: respawnState(train, now) }
    })
    .sort((a, b) => (b.elapsed ?? Infinity) - (a.elapsed ?? Infinity))
}

export function formatDuration(ms: number) {
  const minutes = Math.round(Math.abs(ms) / 60_000)
  if (minutes < 60) return `${minutes}m`
  // Precise enough for respawn countdowns ("opens in 1h 20m")
  if (minutes < 10 * 60) return minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes / 60}h`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
