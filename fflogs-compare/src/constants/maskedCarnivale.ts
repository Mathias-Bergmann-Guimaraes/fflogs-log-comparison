// The Masked Carnivale's weekly targets (https://ffxiv.consolegameswiki.com/wiki/The_Masked_Carnivale).
// They aren't random: the same 20 weeks loop in order, week 1 being the one that started at the reset of
// Tuesday 18 July 2023 (after patch 6.45). Each week has a Novice target (just clear the stage),
// a Moderate one (clear it with one objective) and an Advanced one (with two or three).

const WEEK_MS = 7 * 24 * 3_600_000
const FIRST_WEEK_STARTS = Date.UTC(2023, 6, 18, 8)

// Only stages 02 to 19 come up
export const CARNIVALE_STAGES: Record<number, string> = {
  2: 'Much Ado About Pudding',
  3: 'Waiting for Golem',
  4: 'Gentlemen Prefer Swords',
  5: 'The Threepenny Turtles',
  6: 'Eye Society',
  7: 'A Chorus Slime',
  8: 'Bomb-edy of Errors',
  9: 'To Kill a Mockingslime',
  10: 'A Little Knight Music',
  11: 'Some Like It Excruciatingly Hot',
  12: 'The Plant-om of the Opera',
  13: 'Beauty and a Beast',
  14: 'Blobs in the Woods',
  15: 'The Me Nobody Nodes',
  16: 'Sunset Bull-evard',
  17: 'The Sword of Music',
  18: 'Midsummer Night’s Explosion',
  19: 'On a Clear Day You Can Smell Forever',
}

// What each objective asks, as the game words it
export const CARNIVALE_OBJECTIVES: Record<string, string> = {
  'Too Fast, Too Furious': 'Completed performance faster than the ideal time.',
  'Slow and Steady': 'Completed performance faster than the standard time.',
  'Can’t Touch This': 'Took zero damage.',
  'A Walk in the Park': 'Refrained from using Sprint.',
  'Ain’t Got Time to Bleed': 'Restored zero HP.',
  '4 Ways to Die': 'Used four or fewer unique spells.',
  '10 Ways to Die': 'Used ten or fewer unique spells.',
  'Beginner Spellcasting': 'Cast only rank 1 or 2 spells.',
  'Advanced Spellcasting': 'Cast only rank 4 or 5 spells.',
  'Enfeeble Me Tender': 'Applied six or more unique enfeeblements.',
  'Enfeeble Me Tenderer': 'Applied nine or more unique enfeeblements.',
  'Four-faced': 'Used four or more unique actions that are fired from the face.',
  'Elemental Mastery': 'Cast spells aspected to all six elements.',
  'Modus Interruptus': 'Interrupted a target’s spell casting.',
  'Let’s Get Physical': 'Used only physical-type actions.',
  'Mastery of Fire': 'Cast only fire- or unaspected spells.',
  'Mastery of Water': 'Cast only water- or unaspected spells.',
  'Mastery of Earth': 'Cast only earth- or unaspected spells.',
  'Mastery of Wind': 'Cast only wind- or unaspected spells.',
  'Mastery of Lightning': 'Cast only lightning- or unaspected spells.',
}

export type CarnivaleTarget = { stage: number; objectives: string[] }
export type CarnivaleWeek = { novice: CarnivaleTarget; moderate: CarnivaleTarget; advanced: CarnivaleTarget }

const target = (stage: number, ...objectives: string[]): CarnivaleTarget => ({ stage, objectives })

// [novice, moderate, advanced], weeks 1 to 20
const ROTATION: [CarnivaleTarget, CarnivaleTarget, CarnivaleTarget][] = [
  [target(11), target(15, 'Mastery of Earth'), target(7, 'Too Fast, Too Furious', 'Can’t Touch This', 'Mastery of Wind')],
  [target(14), target(8, 'Beginner Spellcasting'), target(4, 'Enfeeble Me Tenderer', 'Beginner Spellcasting')],
  [target(7), target(3, 'Mastery of Water'), target(18, 'Too Fast, Too Furious', 'Advanced Spellcasting')],
  [target(13), target(9, 'Enfeeble Me Tender'), target(3, 'Ain’t Got Time to Bleed', 'A Walk in the Park', '4 Ways to Die')],
  [target(10), target(14, 'Ain’t Got Time to Bleed'), target(8, 'Too Fast, Too Furious', '4 Ways to Die', 'Mastery of Water')],
  [target(7), target(12, 'Slow and Steady'), target(17, '10 Ways to Die', 'Four-faced')],
  [target(15), target(7, 'Advanced Spellcasting'), target(6, 'Ain’t Got Time to Bleed', 'A Walk in the Park', 'Let’s Get Physical')],
  [target(6), target(9, '10 Ways to Die'), target(16, 'Enfeeble Me Tender', 'A Walk in the Park', 'Four-faced')],
  [target(11), target(13, 'Mastery of Fire'), target(2, 'Elemental Mastery', '10 Ways to Die')],
  [target(15), target(4, 'Mastery of Lightning'), target(10, 'Ain’t Got Time to Bleed', '10 Ways to Die', 'Mastery of Fire')],
  [target(6), target(11, 'Advanced Spellcasting'), target(14, 'Too Fast, Too Furious', 'Can’t Touch This', 'A Walk in the Park')],
  [target(13), target(17, 'Enfeeble Me Tender'), target(9, 'Elemental Mastery', 'Modus Interruptus')],
  [target(10), target(19, 'Slow and Steady'), target(11, 'Too Fast, Too Furious', 'A Walk in the Park', 'Mastery of Lightning')],
  [target(12), target(2, 'Too Fast, Too Furious'), target(15, 'Modus Interruptus', 'A Walk in the Park', 'Four-faced')],
  [target(9), target(6, 'Too Fast, Too Furious'), target(18, 'Let’s Get Physical', 'A Walk in the Park')],
  [target(12), target(10, '4 Ways to Die'), target(19, 'Too Fast, Too Furious', '10 Ways to Die')],
  [target(14), target(16, '10 Ways to Die'), target(9, 'Slow and Steady', 'Enfeeble Me Tenderer')],
  [target(8), target(18, 'Slow and Steady'), target(13, 'Advanced Spellcasting', 'Slow and Steady')],
  [target(9), target(11, 'Beginner Spellcasting'), target(12, 'Too Fast, Too Furious', '10 Ways to Die')],
  [target(8), target(13, 'Too Fast, Too Furious'), target(3, 'Slow and Steady', 'Enfeeble Me Tenderer')],
]

// The week (1 to 20) running up to the reset at `resetsAt`, and its targets
export function carnivaleWeek(resetsAt: number): { number: number; targets: CarnivaleWeek } {
  const weeksIn = Math.round((resetsAt - WEEK_MS - FIRST_WEEK_STARTS) / WEEK_MS)
  const index = ((weeksIn % ROTATION.length) + ROTATION.length) % ROTATION.length
  const [novice, moderate, advanced] = ROTATION[index]!
  return { number: index + 1, targets: { novice, moderate, advanced } }
}
