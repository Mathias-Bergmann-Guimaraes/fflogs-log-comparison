import type { HuntPing, HuntTrainMessage } from '@/types/hunts'
import { expansionOfPlace, parseStartingPoint, type StartingPoint } from '@/constants/aetherytes'
import { useSettingsStore } from '@/stores/settingsStore'

// EU worlds, in the order the Lodestone lists them
export const DATA_CENTERS = [
  { name: 'Light', worlds: ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'] },
  { name: 'Chaos', worlds: ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan'] },
] as const

export type DataCenterName = (typeof DATA_CENTERS)[number]['name']

// Light gold, Chaos purple; checked as a pair against the dark card surface with the dataviz validator
export const DC_COLORS: Record<DataCenterName, string> = { Light: '#b98c0c', Chaos: '#9b72f0' }

// The DC a channel is for, from its name ("#light-trains", "chaos_trains")
export function dcOfChannel(name: string | null | undefined): DataCenterName | null {
  return DATA_CENTERS.find((dc) => name?.toLowerCase().includes(dc.name.toLowerCase()))?.name ?? null
}

const WORLDS = new Map<string, { world: string; dc: DataCenterName }>(
  DATA_CENTERS.flatMap((dc) => dc.worlds.map((world) => [world.toLowerCase(), { world, dc: dc.name }] as const)),
)
const WORLD_WORD_RE = new RegExp(`\\b(${[...WORLDS.keys()].join('|')})\\b`, 'i')

// A trains are pinged per expansion. The hunt server's roles are only known by id, so a ping counts as one of these
// once it's named (DEFAULT_PING_LABELS, or by the user in Name pings on the A-Rank page) with the key or one of the
// aliases, e.g. "7.0" or "Dawntrail".
export type TrainTypeKey = '7.0' | '6.0' | '5.0' | 'old'

// color: an Ant preset, the same as the S rank cards' expansion tags (EXPANSIONS in sRanks.ts)
export const TRAIN_TYPES: { key: TrainTypeKey; label: string; expansion: string; color: string; aliases: string[] }[] = [
  { key: '7.0', label: '7.0', expansion: 'Dawntrail', color: 'green', aliases: ['7.0', '7', 'dt', 'dawntrail'] },
  { key: '6.0', label: '6.0', expansion: 'Endwalker', color: 'geekblue', aliases: ['6.0', '6', 'ew', 'endwalker'] },
  { key: '5.0', label: '5.0', expansion: 'Shadowbringers', color: 'purple', aliases: ['5.0', '5', 'shb', 'shadowbringers'] },
  { key: 'old', label: 'Old', expansion: 'ARR to Stormblood', color: 'red', aliases: ['old', 'older', 'legacy', 'arr', 'hw', 'sb', '4.0', 'stormblood'] },
]

export function trainTypeOfLabel(label: string | undefined): TrainTypeKey | null {
  const l = label?.trim().toLowerCase()
  if (!l) return null
  return TRAIN_TYPES.find((t) => t.aliases.includes(l) || l.includes(t.expansion.toLowerCase()))?.key ?? null
}

// What one A rank pays, per train type (https://ffxiv.consolegameswiki.com/wiki/The_Hunt). "Old" trains are almost
// always Heavensward or Stormblood, so they get that rate rather than ARR's. Mathematics and Mnemonics only drop
// on a level-capped job, so those are the most a train can give. Allied Seals are only ARR's (S ranks, see sRanks.ts).
export const CURRENCIES = ['Sacks of Nuts', 'Centurio Seals', 'Allied Seals', 'Poetics', 'Mathematics', 'Mnemonics'] as const
export type Currency = (typeof CURRENCIES)[number]

export const MARK_REWARDS: Record<TrainTypeKey, Partial<Record<Currency, number>>> = {
  '7.0': { 'Sacks of Nuts': 40, Poetics: 30, Mathematics: 20, Mnemonics: 10 },
  '6.0': { 'Sacks of Nuts': 40, Poetics: 30, Mathematics: 10 },
  '5.0': { 'Sacks of Nuts': 40, Poetics: 30, Mathematics: 10 },
  old: { 'Centurio Seals': 40, Poetics: 30, Mathematics: 10 },
}

export type Train = {
  id: string
  world: string
  dc: DataCenterName
  types: TrainTypeKey[]
  pings: HuntPing[]
  // The <t:…> time in the post ("starting in 10 minutes"), or when it was posted if there is none
  startsAt: number
  // When it counts as over: see isActive
  endsAt: number
  postedAt: number
  conductor: string | null
  start: StartingPoint | null
  // Which expansion an "Old" train is, from where it starts: 2 (ARR), 3 (Heavensward) or 4 (Stormblood); null if unknown
  oldExpansion: OldExpansion | null
  // Marks per expansion, and whether the post said so (otherwise the Settings default for its first type; see marksOf)
  marks: number
  marksGiven: boolean
  speed: TrainSpeed | null
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

// "xx:23" one this long before the post still means this hour's :23 (a late "starting xx:23" post), not the next hour's
const MINUTE_GRACE_MS = 5 * 60_000

// "Starting xx:23": the first :23 after the post. Hours are in whole UTC hours, so this works in any timezone
// that is a whole number of hours from UTC (all of the EU).
function parseMinuteOfHour(content: string, postedAt: number) {
  const minute = /\bxx\s*:\s*([0-5]\d)\b/i.exec(content)?.[1]
  if (minute === undefined) return null
  const hour = Math.floor(postedAt / 3_600_000) * 3_600_000
  const at = hour + Number(minute) * 60_000
  return at < postedAt - MINUTE_GRACE_MS ? at + 3_600_000 : at
}

// The train's start, and whether the post gave one (otherwise it's the posting time)
export function parseStart(content: string, postedAt: number) {
  const unix = /<t:(\d+)(?::[tTdDfFR])?>/.exec(content)?.[1]
  const ms = unix ? Number(unix) * 1000 : NaN
  if (Number.isFinite(ms) && Math.abs(ms - postedAt) <= MAX_START_OFFSET_MS) return { at: ms, given: true }
  const minuteOfHour = parseMinuteOfHour(content, postedAt)
  return minuteOfHour !== null ? { at: minuteOfHour, given: true } : { at: postedAt, given: false }
}

export function parseConductor(content: string) {
  const name = /conductor\s*:\s*(?:\[[^\]]*\]\s*)?([^)\n]+)/i.exec(content.replace(/[*_`]/g, ''))?.[1]
  return name?.replace(/[.\s]+$/, '').trim() || null
}

// A full train is 12 marks, sometimes more ("14/12 marks": 14 is the real count). A post that doesn't say gets the
// count assumed in Settings (12 unless the user changed it, per train type).
// "12/12 marks" first; a bare "x/y" only when y looks like a train's total, so a date like "19/10" doesn't count
export function parseMarks(content: string) {
  const text = content.replace(/https?:\/\/\S+|<[^>]+>/g, ' ')
  const fraction = /(?<![\d/.:])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/.:])(\s*marks?\b)?/gi
  const matches = [...text.matchAll(fraction)].map(([, x, y, word]) => ({ count: Number(x), total: Number(y), word: !!word }))
  const found = matches.find((m) => m.word) ?? matches.find((m) => m.total >= 12 && m.total <= 16)
  return found && found.count >= 1 && found.count <= 30 ? found.count : null
}

// The marks a train does of one of its types: what the post said, else that type's assumed count
export const marksOf = (train: Train, type: TrainTypeKey) => (train.marksGiven ? train.marks : useSettingsStore().trainMarks(type))

export type SpeedKind = 'fast' | 'fastish' | 'slow'

// kind: null when the post has a "Speed: …" we don't recognise; text: the post's own wording
export type TrainSpeed = { kind: SpeedKind | null; text: string }

// Semi-chill first, so its "chill" doesn't count as slow
const SPEED_WORDS: [SpeedKind, RegExp][] = [
  ['fastish', /\bsemi[\s-]?chill\b/i],
  ['fast', /\b(fast|bullet|no[\s-]?stops?|zoomies)\b/i],
  ['slow', /\b(slow|chill)\b/i],
]

const SPEED_FIELD_RE = /\b(?:speed|pace)\s*[:=\-–]\s*([^\n|]+)/i
const MAX_SPEED_TEXT = 40

function speedKind(text: string): { kind: SpeedKind; word: string } | null {
  for (const [kind, re] of SPEED_WORDS) {
    const word = re.exec(text)?.[0]
    if (word) return { kind, word }
  }
  return null
}

// "Speed: bullet" first, then a speed word anywhere in the post
export function parseSpeed(content: string): TrainSpeed | null {
  const text = content.replace(/https?:\/\/\S+|<[^>]+>/g, ' ').replace(/[*_`~]/g, '')
  const field = SPEED_FIELD_RE.exec(text)?.[1]?.trim()
  if (field) {
    const shown = field.length > MAX_SPEED_TEXT ? `${field.slice(0, MAX_SPEED_TEXT).trimEnd()}…` : field
    return { kind: speedKind(field)?.kind ?? null, text: shown }
  }
  const found = speedKind(text)
  return found ? { kind: found.kind, text: found.word } : null
}

// Everything a train pays, summed over its expansions (a double train does each expansion's marks)
export type OldExpansion = 2 | 3 | 4

// ARR A ranks pay Allied Seals too; used for an "Old" train known to be ARR (by where it starts)
const ARR_MARK_REWARDS: Partial<Record<Currency, number>> = { 'Allied Seals': 40, 'Centurio Seals': 20, Poetics: 30, Mathematics: 10 }

const markRewards = (train: Train, type: TrainTypeKey) => (type === 'old' && train.oldExpansion === 2 ? ARR_MARK_REWARDS : MARK_REWARDS[type])

export function trainRewards(train: Train): { currency: Currency; amount: number }[] {
  return CURRENCIES.map((currency) => ({
    currency,
    amount: train.types.reduce((sum, type) => sum + (markRewards(train, type)[currency] ?? 0) * marksOf(train, type), 0),
  })).filter((r) => r.amount > 0)
}

function oldExpansionOf(start: StartingPoint | null): OldExpansion | null {
  const expansion = expansionOfPlace(start)
  return expansion === 2 || expansion === 3 || expansion === 4 ? expansion : null
}

export function parseTrain(message: HuntTrainMessage, labels: Record<string, string>): Train | null {
  const place = parseWorld(message.content)
  if (!place) return null
  const types = [...new Set(message.pings.map((ping) => trainTypeOfLabel(labels[ping])).filter((t) => t !== null))]
  const start = parseStart(message.content, message.createdAt)
  const marks = parseMarks(message.content)
  // Without links and mentions, so an image id or role number can't look like a place
  const startPoint = parseStartingPoint(message.content.replace(/https?:\/\/\S+|<[^>]+>/g, ' '))
  return {
    id: message.id,
    ...place,
    types,
    pings: message.pings,
    startsAt: start.at,
    endsAt: start.at + useSettingsStore().trainRunningMs(start.given),
    postedAt: message.createdAt,
    conductor: parseConductor(message.content),
    start: startPoint,
    oldExpansion: types.includes('old') ? oldExpansionOf(startPoint) : null,
    marks: marks ?? useSettingsStore().trainMarks(types[0] ?? null),
    marksGiven: marks !== null,
    speed: parseSpeed(message.content),
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

// A train counts as running a while after its start (15 minutes unless the user changed it in Settings). A post
// without a start time is usually sent a while before the train leaves, so that counts from the post and runs longer.

// Running or still to come
export const isActive = (train: Train, now: number) => now < train.endsAt

// A ranks respawn 3 to 6 hours after they die (the user can change that in Settings, per train type). A train kills
// all 12 of an expansion's A ranks on a world, so the next one there can't start before the window opens, gets
// likelier towards its end, and from then on can start anytime.
export const respawnWindow = (type: TrainTypeKey) => useSettingsStore().respawnWindowMs(type)

export type Respawn =
  | { phase: 'unseen' | 'open' | 'announced' | 'running' }
  | { phase: 'cooldown'; opensAt: number; fullAt: number }
  // progress: how far through the respawn window, 0 to 1
  | { phase: 'window'; opensAt: number; fullAt: number; progress: number }

export function respawnState(last: Train | null, type: TrainTypeKey, now: number): Respawn {
  if (!last) return { phase: 'unseen' }
  if (now < last.startsAt) return { phase: 'announced' }
  const endedAt = last.endsAt
  if (now < endedAt) return { phase: 'running' }
  const { min, max } = respawnWindow(type)
  const opensAt = endedAt + min
  const fullAt = endedAt + max
  if (now < opensAt) return { phase: 'cooldown', opensAt, fullAt }
  if (now < fullAt) return { phase: 'window', opensAt, fullAt, progress: (now - opensAt) / (fullAt - opensAt) }
  return { phase: 'open' }
}

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
      return { world, dc: dc.name, last: train, elapsed: train ? now - train.startsAt : null, respawn: respawnState(train, type, now) }
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
