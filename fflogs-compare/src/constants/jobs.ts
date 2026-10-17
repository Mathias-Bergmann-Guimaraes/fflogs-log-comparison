// Job names match the icon filenames in public/job/
export const jobsByRole = [
  { role: 'Tanks', jobs: ['Paladin', 'Warrior', 'DarkKnight', 'Gunbreaker'] },
  { role: 'Healers', jobs: ['WhiteMage', 'Scholar', 'Astrologian', 'Sage'] },
  { role: 'Melee', jobs: ['Monk', 'Dragoon', 'Ninja', 'Samurai', 'Reaper', 'Viper'] },
  { role: 'Physical Ranged', jobs: ['Bard', 'Machinist', 'Dancer'] },
  { role: 'Casters', jobs: ['BlackMage', 'Summoner', 'RedMage', 'Pictomancer'] },
]

// 'DarkKnight' -> 'Dark Knight'
export function jobDisplayName(job: string) {
  return job.replace(/([a-z])([A-Z])/g, '$1 $2')
}
