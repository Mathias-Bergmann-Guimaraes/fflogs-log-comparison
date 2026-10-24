// The things worth doing every week, all of which come back at the weekly reset (Tuesday 08:00 UTC).
// `count`: how many times it can be done a week (a stepper instead of a checkbox); `link`: a helper site.
export type WeeklyActivity = {
  id: string
  name: string
  description: string
  count?: number
  countLabel?: string
  link?: { label: string; url: string }
}

// A card shows one activity, or a few similar ones under its own title
export type WeeklyCard = { key: string; title?: string; activities: WeeklyActivity[] }

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
        activities: [
          {
            id: 'savage',
            name: 'Savage raid',
            description: 'One loot roll per floor a week.',
            count: 4,
            countLabel: 'floors',
          },
          {
            id: 'normalRaid',
            name: 'Normal raid',
            description: 'One loot roll per floor a week.',
            count: 4,
            countLabel: 'floors',
          },
          {
            id: 'alliance',
            name: 'Alliance raid',
            description: 'The current alliance raid gives its reward coffer once a week.',
          },
        ],
      },
      single({
        id: 'fauxHollows',
        name: 'Faux Hollows',
        description:
          'Clear the current Unreal trial, then play the Faux Commander’s board in Idyllshire. Uncover the large illustration for a retelling: one more try this week.',
        count: 2,
        countLabel: 'boards',
        link: { label: 'Faux Hollows solver', url: 'https://faux.joshuaen.com' },
      }),
      single({
        id: 'tomestones',
        name: 'Tomestone cap',
        description: 'Cap this week’s current tomestones (see the cap in Settings).',
      }),
      single({
        id: 'eliteMarks',
        name: 'Elite hunt marks',
        description: 'Each expansion’s weekly elite mark bill from its Hunt Board.',
      }),
      single({
        id: 'carnivale',
        name: 'Masked Carnivale',
        description: 'The three weekly targets in the Masked Carnivale log (Blue Mage).',
        count: 3,
        countLabel: 'targets',
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
        description: 'Pick up a journal from Khloe in Idyllshire, fill it with seals and hand it in before the reset.',
      }),
      single({
        id: 'challengeLog',
        name: 'Challenge Log',
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
        description: 'Twelve allowances a week, shared between every Custom Delivery client.',
        count: 12,
        countLabel: 'allowances',
      }),
      single({
        id: 'domanEnclave',
        name: 'Doman Enclave',
        description: 'Donate items to the Enclave’s reconstruction, up to the weekly gil budget.',
      }),
      single({
        id: 'islandSanctuary',
        name: 'Island Sanctuary',
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
        description: 'Judging opens on Friday (08:00 UTC) and runs until the reset. Four tries a week; 80 points or more pays out.',
      }),
      single({
        id: 'jumboCactpot',
        name: 'Jumbo Cactpot',
        description: 'Three tickets a week, drawn on Saturday.',
        count: 3,
        countLabel: 'tickets',
      }),
    ],
  },
]

export const weeklyActivities = weeklyGroups.flatMap((group) => group.cards.flatMap((card) => card.activities))
