// Job names match the icon filenames in public/job/
export const jobsByRole = [
  { role: 'Tanks', jobs: ['Paladin', 'Warrior', 'DarkKnight', 'Gunbreaker'] },
  { role: 'Healers', jobs: ['WhiteMage', 'Scholar', 'Astrologian', 'Sage'] },
  { role: 'Melee', jobs: ['Monk', 'Dragoon', 'Ninja', 'Samurai', 'Reaper', 'Viper'] },
  { role: 'Physical Ranged', jobs: ['Bard', 'Machinist', 'Dancer'] },
  { role: 'Casters', jobs: ['BlackMage', 'Summoner', 'RedMage', 'Pictomancer'] },
]

// In-game abbreviations, as xivgear and XIVAPI's ClassJobCategory use them
export const jobAbbreviations: Record<string, string> = {
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

// 'DarkKnight' -> 'Dark Knight'
export function jobDisplayName(job: string) {
  return job.replace(/([a-z])([A-Z])/g, '$1 $2')
}
