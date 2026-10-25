// Shared by the API server (server/plugin.ts) and the Settings page. No imports, so the server can import it.
// What these hold and where a plugin reads them from in the game: PLUGIN_API.md at the repo root.

// Job abbreviations as the game shows them: 'PLD', 'WHM', 'CRP', ...
export type PluginJob = string

// Who the data is about. contentId is the game's id for the character (decimal string, it doesn't fit a JS number).
export type PluginCharacter = { contentId: string; name: string; world: string; dataCenter?: string }

// An item in a gear slot. materia: the item ids of the melded materia, in meld order.
export type PluginGearItem = { slot: PluginGearSlot; itemId: number; hq: boolean; materia: number[] }

export const PLUGIN_GEAR_SLOTS = [
  'mainHand',
  'offHand',
  'head',
  'body',
  'hands',
  'legs',
  'feet',
  'earrings',
  'necklace',
  'bracelets',
  'ring1',
  'ring2',
  'soulCrystal',
] as const
export type PluginGearSlot = (typeof PLUGIN_GEAR_SLOTS)[number]

// --- Snapshots: the latest of each replaces the one before ---

export type PluginSnapshots = {
  character: { name: string; world: string; dataCenter?: string }
  // levels: every job's level, unlocked ones only
  jobs: { current: PluginJob; levels: Record<PluginJob, number> }
  // What's equipped right now
  gear: { job: PluginJob; itemLevel?: number; items: PluginGearItem[] }
  // The saved gearsets. index: the game's gearset number (0-based)
  gearsets: { sets: { index: number; name: string; job: PluginJob; itemLevel?: number; items: PluginGearItem[] }[] }
  // Counts held, summed over bags (NQ + HQ)
  inventory: { items: { itemId: number; count: number }[] }
  // This week's progress; every part is optional. activities: the Weekly page's checklist, by activity id
  // (constants/weeklyActivities.ts), same numbers it saves
  weekly: {
    tomestones?: { itemId?: number; earned: number; cap: number }
    wondrousTails?: { stickers: number; secondChancePoints: number }
    customDeliveries?: { allowancesLeft: number }
    activities?: Record<string, number>
  }
}
export type PluginSnapshotKind = keyof PluginSnapshots

// --- Events: appended, newest kept ---

export type PluginEvents = {
  dutyCompleted: { territoryId: number; contentId?: number; name: string; durationMs?: number }
  loot: { itemId: number; count: number; hq: boolean; dutyName?: string }
}
export type PluginEventType = keyof PluginEvents

export type PluginEvent = {
  [T in PluginEventType]: { type: T; characterId: string; occurredAt: number; data: PluginEvents[T] }
}[PluginEventType]

// GET /api/plugin/data: everything received, per character
export type PluginStoredSnapshot<K extends PluginSnapshotKind> = { data: PluginSnapshots[K]; capturedAt: number; receivedAt: number }
export type PluginData = {
  characters: { contentId: string; snapshots: { [K in PluginSnapshotKind]?: PluginStoredSnapshot<K> } }[]
  events: PluginEvent[]
}

// GET /api/plugin/tokens. The token itself is only in the POST's answer, once.
export type PluginToken = { id: number; name: string; createdAt: number; lastUsedAt: number | null }
export type NewPluginToken = PluginToken & { token: string }
