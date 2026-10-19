// Which jobs can wear the same gear, so their BiS progress can be linked slot by slot.
// Also imported by the server (server/bis.ts), so keep this file free of imports and enums.

// Slot indexes match the `slots` layout in views/bis-tracker/JobBisCard.vue
export const SLOT_COUNT = 11
export const ARMOUR_SLOTS: readonly number[] = [0, 1, 2, 3, 4]
export const ACCESSORY_SLOTS: readonly number[] = [5, 6, 7, 8, 9]
// Weapons are job-specific, so this slot is never shared
export const WEAPON_SLOT = 10

// Fending / Healing / Striking / Maiming / Scouting / Aiming / Casting
const armourGroups: readonly (readonly string[])[] = [
  ['Paladin', 'Warrior', 'DarkKnight', 'Gunbreaker'],
  ['WhiteMage', 'Scholar', 'Astrologian', 'Sage'],
  ['Monk', 'Samurai'],
  ['Dragoon', 'Reaper'],
  ['Ninja', 'Viper'],
  ['Bard', 'Machinist', 'Dancer'],
  ['BlackMage', 'Summoner', 'RedMage', 'Pictomancer'],
]

// Fending / Healing / Slaying / Aiming / Casting
const accessoryGroups: readonly (readonly string[])[] = [
  ['Paladin', 'Warrior', 'DarkKnight', 'Gunbreaker'],
  ['WhiteMage', 'Scholar', 'Astrologian', 'Sage'],
  ['Monk', 'Samurai', 'Dragoon', 'Reaper'],
  ['Ninja', 'Viper', 'Bard', 'Machinist', 'Dancer'],
  ['BlackMage', 'Summoner', 'RedMage', 'Pictomancer'],
]

export const allJobs: readonly string[] = armourGroups.flat()

const sameGroup = (groups: readonly (readonly string[])[], a: string, b: string) => groups.some((g) => g.includes(a) && g.includes(b))

// Slot indexes two different jobs can share; empty if none
export function sharedSlots(a: string, b: string): number[] {
  if (a === b) return []
  return [...(sameGroup(armourGroups, a, b) ? ARMOUR_SLOTS : []), ...(sameGroup(accessoryGroups, a, b) ? ACCESSORY_SLOTS : [])]
}

// Jobs that share at least one slot with this one: full matches first, then accessory-only
export function linkableJobs(job: string): string[] {
  return allJobs.filter((other) => sharedSlots(job, other).length).sort((a, b) => sharedSlots(job, b).length - sharedSlots(job, a).length)
}
