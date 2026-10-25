import raidIcon from '@/assets/raid.png'
import tomeIcon from '@/assets/Allagan_Tomestone_of_Mnemonics.png'
import highEndIcon from '@/assets/ultimate.png'
import fauxIcon from '@/assets/weekly/faux-leaf.png'
import eliteMarkIcon from '@/assets/weekly/elite-mark-bill.png'
import carnivaleIcon from '@/assets/weekly/masked-carnivale.png'
import wondrousTailsIcon from '@/assets/weekly/wondrous-tails.png'
import challengeLogIcon from '@/assets/weekly/challenge-log.png'
import customDeliveriesIcon from '@/assets/weekly/custom-deliveries.png'
import gilIcon from '@/assets/weekly/gil.png'
import islandIcon from '@/assets/weekly/island-sanctuary.png'
import goldSaucerIcon from '@/assets/weekly/gold-saucer.png'
import mgpIcon from '@/assets/weekly/mgp.png'
import alliedSealIcon from '@/assets/Allied_Seal.png'
import centurioSealIcon from '@/assets/Centurio_Seal.png'
import nutsIcon from '@/assets/Sack_of_Nuts.png'
import { EXPANSIONS, type ExpansionKey } from '@/views/hunts/dashboard/sRanks'
// This tier's bosses (AAC Heavyweight) and the current alliance raid's (Windurst: The Third Walk): swap at a new tier
import vampFataleIcon from '@/assets/weekly/raids/vamp-fatale.png'
import xtremesIcon from '@/assets/weekly/raids/the-xtremes.png'
import tyrantIcon from '@/assets/weekly/raids/the-tyrant.png'
import lindwurmIcon from '@/assets/weekly/raids/lindwurm.png'
import shantottoIcon from '@/assets/weekly/raids/shantotto.png'

// The things worth doing every week, all of which come back at the weekly reset (Tuesday 08:00 UTC).
// `icon`: the game's own (XIVAPI); `count`: how many times it can be done a week (a stepper instead of a checkbox);
// `parts`: separate things to tick, one button each (done once they all are), shown as a list or, with `tiles`,
// as a row of pictures (each part's icon); `cumulative`: a part done means the ones before it are too;
// `link`: a helper site.
export type WeeklyActivity = {
  id: string
  name: string
  icon: string
  description: string
  count?: number
  countLabel?: string
  parts?: WeeklyPart[]
  tiles?: boolean
  cumulative?: boolean
  link?: { label: string; url: string }
}

// `tag` and `color` (an Ant preset) label the row; `hint` says where it's done, `reward` and `icon` what it pays
export type WeeklyPart = { key: string; tag: string; color: string; name: string; hint?: string; reward?: string; icon?: string }

// The tier's four floors, normal (`M9`) or savage (`M9S`), each with its boss
const raidFloors = (suffix: string): WeeklyPart[] =>
  [
    { name: 'Vamp Fatale', icon: vampFataleIcon },
    { name: 'The Xtremes', icon: xtremesIcon },
    { name: 'The Tyrant', icon: tyrantIcon },
    { name: 'The Lindwurm', icon: lindwurmIcon },
  ].map((boss, i) => ({ key: String(i + 1), tag: `M${9 + i}${suffix}`, color: 'default', ...boss }))

// One elite mark bill per expansion's Hunt Board, and the currency it pays
const eliteMarkBill = (expansion: ExpansionKey, hint: string, reward: string, icon: string): WeeklyPart => ({
  key: String(expansion),
  tag: EXPANSIONS[expansion].label,
  color: EXPANSIONS[expansion].color,
  name: EXPANSIONS[expansion].name,
  hint,
  reward,
  icon,
})

// A card shows one activity, or a few similar ones under its own title
export type WeeklyCard = { key: string; title?: string; icon?: string; activities: WeeklyActivity[] }

export type WeeklyGroup = { key: string; title: string; cards: WeeklyCard[] }

// One card per activity
const single = (activity: WeeklyActivity): WeeklyCard => ({ key: activity.id, activities: [activity] })

export const weeklyGroups: WeeklyGroup[] = [
  {
    key: 'combat',
    title: 'Combat',
    cards: [
      {
        key: 'raids',
        title: 'Raids',
        icon: raidIcon,
        activities: [
          {
            id: 'savage',
            name: 'Savage raid',
            icon: highEndIcon,
            description: 'One loot roll per floor a week. Clearing a floor locks the loot of the floors before it.',
            parts: raidFloors('S'),
            tiles: true,
            cumulative: true,
          },
          {
            id: 'normalRaid',
            name: 'Normal raid',
            icon: raidIcon,
            description: 'One loot roll per floor a week.',
            parts: raidFloors(''),
            tiles: true,
          },
          {
            id: 'alliance',
            name: 'Alliance raid',
            icon: raidIcon,
            description: 'The current alliance raid gives its reward coffer once a week.',
            parts: [{ key: 'thirdWalk', tag: 'Third Walk', color: 'default', name: 'Windurst: The Third Walk', icon: shantottoIcon }],
            tiles: true,
          },
        ],
      },
      single({
        id: 'fauxHollows',
        name: 'Faux Hollows',
        icon: fauxIcon,
        description:
          'Clear the current Unreal trial, then play the Faux Commander’s board in Idyllshire. Uncover the large illustration for a retelling: one more try this week.',
        count: 2,
        countLabel: 'boards',
        link: { label: 'Faux Hollows solver', url: 'https://faux.joshuaen.com' },
      }),
      single({
        id: 'tomestones',
        name: 'Tomestone cap',
        icon: tomeIcon,
        description: 'Earn this week’s cap of the current tomestones (set the cap in Settings). Ticks itself once you reach it.',
      }),
      single({
        id: 'eliteMarks',
        name: 'Elite hunt marks',
        icon: eliteMarkIcon,
        description: 'Each expansion’s weekly elite mark bill from its Hunt Board.',
        parts: [
          eliteMarkBill(2, 'Grand Company', 'Allied Seals', alliedSealIcon),
          eliteMarkBill(3, 'Foundation', 'Centurio Seals', centurioSealIcon),
          eliteMarkBill(4, 'Rhalgr’s Reach', 'Centurio Seals', centurioSealIcon),
          eliteMarkBill(5, 'The Crystarium', 'Sacks of Nuts', nutsIcon),
          eliteMarkBill(6, 'Old Sharlayan', 'Sacks of Nuts', nutsIcon),
          eliteMarkBill(7, 'Tuliyollal', 'Sacks of Nuts', nutsIcon),
        ],
      }),
      single({
        id: 'carnivale',
        name: 'Masked Carnivale',
        icon: carnivaleIcon,
        description: 'This week’s three targets in the Masked Carnivale log (Blue Mage).',
        // Keys match MaskedCarnivale's rows; the stages and objectives come from the rotation (maskedCarnivale.ts)
        parts: [
          { key: 'novice', tag: 'C', color: 'blue', name: 'Novice' },
          { key: 'moderate', tag: 'B', color: 'default', name: 'Moderate' },
          { key: 'advanced', tag: 'A', color: 'gold', name: 'Advanced' },
        ],
      }),
    ],
  },
  {
    key: 'journal',
    title: 'Journals & logs',
    cards: [
      single({
        id: 'wondrousTails',
        name: 'Wondrous Tails',
        icon: wondrousTailsIcon,
        description: 'Pick up a journal from Khloe in Idyllshire, fill it with seals and hand it in before the reset.',
      }),
      single({
        id: 'challengeLog',
        name: 'Challenge Log',
        icon: challengeLogIcon,
        description: 'Weekly objectives for bonus EXP, gil and MGP.',
      }),
    ],
  },
  {
    key: 'crafting',
    title: 'Crafting & gathering',
    cards: [
      single({
        id: 'customDeliveries',
        name: 'Custom Deliveries',
        icon: customDeliveriesIcon,
        description: 'Twelve allowances a week, shared between every Custom Delivery client.',
        count: 12,
        countLabel: 'allowances',
      }),
      single({
        id: 'domanEnclave',
        name: 'Doman Enclave',
        icon: gilIcon,
        description: 'Donate items to the Enclave’s reconstruction, up to the weekly gil budget.',
      }),
      single({
        id: 'islandSanctuary',
        name: 'Island Sanctuary',
        icon: islandIcon,
        description: 'Plan the workshop’s new week of agendas, and collect the last week’s earnings.',
      }),
    ],
  },
  {
    key: 'goldSaucer',
    title: 'Gold Saucer',
    cards: [
      single({
        id: 'fashionReport',
        name: 'Fashion Report',
        icon: goldSaucerIcon,
        description: 'Judging opens on Friday (08:00 UTC) and runs until the reset. Four tries a week; 80 points or more pays out.',
      }),
      single({
        id: 'jumboCactpot',
        name: 'Jumbo Cactpot',
        icon: mgpIcon,
        description: 'Three tickets a week, drawn on Saturday.',
        count: 3,
        countLabel: 'tickets',
      }),
    ],
  },
]

export const weeklyActivities = weeklyGroups.flatMap((group) => group.cards.flatMap((card) => card.activities))
