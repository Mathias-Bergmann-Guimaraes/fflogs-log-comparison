// Ultimate raids and the item level they sync gear to, newest first.
// Source: https://ffxiv.consolegameswiki.com/wiki/Ultimate_Raids
// weapon: how the names of its weapons start ("Ultimate Omega Sword", "Palazzo Diamond Bayonet"); they sit at the sync's
// item level. UWU gives no weapons. Also imported by scripts/gear-icons.ts, so keep this file free of imports.
export const ultimates: readonly { key: string; name: string; sync: number; weapon?: string }[] = [
  { key: 'DMU', name: 'Dancing Mad', sync: 795, weapon: 'Palazzo Diamond ' },
  { key: 'FRU', name: 'Futures Rewritten', sync: 735, weapon: 'Ultimate Edenmorn ' },
  { key: 'TOP', name: 'The Omega Protocol', sync: 635, weapon: 'Ultimate Omega ' },
  { key: 'DSR', name: "Dragonsong's Reprise", sync: 605, weapon: 'Ultimate ' },
  { key: 'TEA', name: 'The Epic of Alexander', sync: 475, weapon: 'Ultimate ' },
  { key: 'UWU', name: "The Weapon's Refrain", sync: 375 },
  { key: 'UCoB', name: 'The Unending Coil of Bahamut', sync: 345, weapon: 'Ultimate Dreadwyrm ' },
]

export type Ultimate = (typeof ultimates)[number]

// Whether an item is this ultimate's weapon
export const isUltimateWeapon = (ultimate: Ultimate, name: string, ilvl: number) =>
  !!ultimate.weapon && ilvl === ultimate.sync && name.startsWith(ultimate.weapon)

// The newest ultimate with weapons inside an item level range, if any
export const ultimateWithin = (minIlvl: number, maxIlvl: number) => ultimates.find((u) => u.weapon && u.sync >= minIlvl && u.sync <= maxIlvl)

// How far below the sync a preset's range reaches. Gear above the sync is synced down in-game, so the range stops there;
// below it, this takes in the tier's raid and tome pieces (sync - 5) plus the dungeon, crafted and normal raid gear under them.
const RANGE_BELOW_SYNC = 25

export const ultimateRange = (sync: number) => ({ minIlvl: sync - RANGE_BELOW_SYNC, maxIlvl: sync })

// The ultimate whose preset range this is, if any
export function ultimateForRange(minIlvl: number, maxIlvl: number) {
  return ultimates.find((u) => maxIlvl === u.sync && minIlvl === u.sync - RANGE_BELOW_SYNC)
}
