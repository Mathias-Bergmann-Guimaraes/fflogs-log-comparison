import type { Currency } from '@/views/hunts/dashboard/trains'

// What a relic stage costs per weapon in one currency. via: when the currency buys an item that's traded for the weapon
// (Phantom: 3 arcanite of 500 Mathematics each), which players can hold on to; amount is then perWeapon x each.
export type StageItem = { item: string; perWeapon: number; each: number }
export type StageCost = { currency: Currency; amount: number; via?: StageItem }

// A stage paid for through an item bought with the currency
const viaItem = (currency: Currency, item: string, perWeapon: number, each: number): StageCost => ({
  currency,
  amount: perWeapon * each,
  via: { item, perWeapon, each },
})

// Relic weapon series, oldest first, and the stages each one is upgraded through.
// Source: https://ffxiv.consolegameswiki.com/wiki/Relic_Weapons
// stages: the name every job's weapon shares at that stage ("Zeta" for Excalibur Zeta, Ragnarok Zeta...), in upgrade order.
// weapons: the item id of each combat job's weapon at every stage, in stage order (job names as in constants/jobs.ts), for its
// icon and name from XIVAPI. Found on XIVAPI by item level and name (the paladin's sword; its shield isn't tracked).
// Crafting and gathering tools aren't tracked.
// costs: what each stage costs per weapon, by stage index, where it's known; undefined stages (or series) show none.
// joinedStages: stages shown in the column of the stage before them (a free upgrade that comes with it)
// jobs: the jobs with a weapon in the series, from `weapons`
export type RelicSeries = {
  key: string
  name: string
  expansion: string
  stages: readonly string[]
  weapons: Readonly<Record<string, readonly number[]>>
  costs?: readonly (StageCost | undefined)[]
  joinedStages?: readonly number[]
  jobs: readonly string[]
}

const series: readonly Omit<RelicSeries, 'jobs'>[] = [
  {
    key: 'zodiac',
    name: 'Zodiac Weapons',
    expansion: 'A Realm Reborn',
    stages: ['Base', 'Zenith', 'Atma', 'Animus', 'Novus', 'Nexus', 'Zodiac Braves', 'Zeta'],
    weapons: {
      Paladin: [1675, 6257, 7824, 7834, 7863, 8649, 9491, 10054],
      Warrior: [1816, 6259, 7826, 7836, 7865, 8651, 9493, 10056],
      WhiteMage: [2052, 6262, 7829, 7839, 7868, 8654, 9496, 10059],
      Scholar: [2214, 6265, 7832, 7842, 7871, 8657, 9499, 10062],
      Monk: [1746, 6258, 7825, 7835, 7864, 8650, 9492, 10055],
      Dragoon: [1885, 6260, 7827, 7837, 7866, 8652, 9494, 10057],
      Ninja: [7888, 9250, 9251, 9252, 9253, 9254, 9501, 10064],
      Bard: [1955, 6261, 7828, 7838, 7867, 8653, 9495, 10058],
      BlackMage: [2140, 6263, 7830, 7840, 7869, 8655, 9497, 10060],
      Summoner: [2213, 6264, 7831, 7841, 7870, 8656, 9498, 10061],
    },
  },
  {
    key: 'anima',
    name: 'Anima Weapons',
    expansion: 'Heavensward',
    stages: ['Animated', 'Awoken', 'Anima', 'Hyperconductive', 'Reconditioned', 'Sharpened', 'Complete', 'Lux'],
    weapons: {
      Paladin: [13611, 13597, 13223, 14870, 15223, 15237, 15251, 16050],
      Warrior: [13613, 13599, 13225, 14872, 15225, 15239, 15253, 16052],
      WhiteMage: [13619, 13605, 13231, 14878, 15231, 15245, 15259, 16058],
      Scholar: [13622, 13608, 13234, 14881, 15234, 15248, 15262, 16061],
      Monk: [13612, 13598, 13224, 14871, 15224, 15238, 15252, 16051],
      Dragoon: [13614, 13600, 13226, 14873, 15226, 15240, 15254, 16053],
      Ninja: [13616, 13602, 13228, 14875, 15228, 15242, 15256, 16055],
      Bard: [13615, 13601, 13227, 14874, 15227, 15241, 15255, 16054],
      BlackMage: [13620, 13606, 13232, 14879, 15232, 15246, 15260, 16059],
      Summoner: [13621, 13607, 13233, 14880, 15233, 15247, 15261, 16060],
      DarkKnight: [13617, 13603, 13229, 14876, 15229, 15243, 15257, 16056],
      Astrologian: [13623, 13609, 13235, 14882, 15235, 15249, 15263, 16062],
      Machinist: [13618, 13604, 13230, 14877, 15230, 15244, 15258, 16057],
    },
  },
  {
    key: 'eureka',
    name: 'Eurekan Weapons',
    expansion: 'Stormblood',
    stages: [
      'Antiquated',
      'Base',
      'Base +1',
      'Base +2',
      'Anemos',
      'Pagos',
      'Pagos +1',
      'Elemental',
      'Elemental +1',
      'Elemental +2',
      'Pyros',
      'Hydatos',
      'Hydatos +1',
      'Base Eureka',
      'Eureka',
      'Physeos',
    ],
    weapons: {
      Paladin: [17817, 21942, 21958, 21974, 21990, 22925, 22941, 22957, 24039, 24055, 24071, 24643, 24659, 24675, 24691, 24707],
      Warrior: [17819, 21944, 21960, 21976, 21992, 22927, 22943, 22959, 24041, 24057, 24073, 24645, 24661, 24677, 24693, 24709],
      WhiteMage: [17825, 21950, 21966, 21982, 21998, 22933, 22949, 22965, 24047, 24063, 24079, 24651, 24667, 24683, 24699, 24715],
      Scholar: [17828, 21953, 21969, 21985, 22001, 22936, 22952, 22968, 24050, 24066, 24082, 24654, 24670, 24686, 24702, 24718],
      Monk: [17818, 21943, 21959, 21975, 21991, 22926, 22942, 22958, 24040, 24056, 24072, 24644, 24660, 24676, 24692, 24708],
      Dragoon: [17820, 21945, 21961, 21977, 21993, 22928, 22944, 22960, 24042, 24058, 24074, 24646, 24662, 24678, 24694, 24710],
      Ninja: [17822, 21947, 21963, 21979, 21995, 22930, 22946, 22962, 24044, 24060, 24076, 24648, 24664, 24680, 24696, 24712],
      Bard: [17821, 21946, 21962, 21978, 21994, 22929, 22945, 22961, 24043, 24059, 24075, 24647, 24663, 24679, 24695, 24711],
      BlackMage: [17826, 21951, 21967, 21983, 21999, 22934, 22950, 22966, 24048, 24064, 24080, 24652, 24668, 24684, 24700, 24716],
      Summoner: [17827, 21952, 21968, 21984, 22000, 22935, 22951, 22967, 24049, 24065, 24081, 24653, 24669, 24685, 24701, 24717],
      DarkKnight: [17823, 21948, 21964, 21980, 21996, 22931, 22947, 22963, 24045, 24061, 24077, 24649, 24665, 24681, 24697, 24713],
      Astrologian: [17829, 21954, 21970, 21986, 22002, 22937, 22953, 22969, 24051, 24067, 24083, 24655, 24671, 24687, 24703, 24719],
      Machinist: [17824, 21949, 21965, 21981, 21997, 22932, 22948, 22964, 24046, 24062, 24078, 24650, 24666, 24682, 24698, 24714],
      Samurai: [17830, 21955, 21971, 21987, 22003, 22938, 22954, 22970, 24052, 24068, 24084, 24656, 24672, 24688, 24704, 24720],
      RedMage: [17831, 21956, 21972, 21988, 22004, 22939, 22955, 22971, 24053, 24069, 24085, 24657, 24673, 24689, 24705, 24721],
    },
  },
  {
    key: 'resistance',
    name: 'Resistance Weapons',
    expansion: 'Shadowbringers',
    stages: ['Resistance', 'Augmented Resistance', 'Recollection', "Law's Order", "Augmented Law's Order", "Blade's"],
    weapons: {
      Paladin: [30228, 30767, 30785, 32651, 32669, 33462],
      Warrior: [30230, 30769, 30787, 32653, 32671, 33464],
      WhiteMage: [30236, 30775, 30793, 32659, 32677, 33470],
      Scholar: [30239, 30778, 30796, 32662, 32680, 33473],
      Monk: [30229, 30768, 30786, 32652, 32670, 33463],
      Dragoon: [30231, 30770, 30788, 32654, 32672, 33465],
      Ninja: [30233, 30772, 30790, 32656, 32674, 33467],
      Bard: [30232, 30771, 30789, 32655, 32673, 33466],
      BlackMage: [30237, 30776, 30794, 32660, 32678, 33471],
      Summoner: [30238, 30777, 30795, 32661, 32679, 33472],
      DarkKnight: [30234, 30773, 30791, 32657, 32675, 33468],
      Astrologian: [30240, 30779, 30797, 32663, 32681, 33474],
      Machinist: [30235, 30774, 30792, 32658, 32676, 33469],
      Samurai: [30241, 30780, 30798, 32664, 32682, 33475],
      RedMage: [30242, 30781, 30799, 32665, 32683, 33476],
      Gunbreaker: [30243, 30782, 30800, 32666, 32684, 33477],
      Dancer: [30244, 30783, 30801, 32667, 32685, 33478],
    },
  },
  {
    key: 'manderville',
    name: 'Manderville Weapons',
    expansion: 'Endwalker',
    stages: ['Manderville', 'Amazing Manderville', 'Majestic Manderville', 'Mandervillous'],
    weapons: {
      Paladin: [38400, 39144, 39920, 40932],
      Warrior: [38402, 39146, 39922, 40934],
      WhiteMage: [38408, 39152, 39928, 40940],
      Scholar: [38411, 39155, 39931, 40943],
      Monk: [38401, 39145, 39921, 40933],
      Dragoon: [38403, 39147, 39923, 40935],
      Ninja: [38405, 39149, 39925, 40937],
      Bard: [38404, 39148, 39924, 40936],
      BlackMage: [38409, 39153, 39929, 40941],
      Summoner: [38410, 39154, 39930, 40942],
      DarkKnight: [38406, 39150, 39926, 40938],
      Astrologian: [38412, 39156, 39932, 40944],
      Machinist: [38407, 39151, 39927, 40939],
      Samurai: [38413, 39157, 39933, 40945],
      RedMage: [38414, 39158, 39934, 40946],
      Gunbreaker: [38415, 39159, 39935, 40947],
      Dancer: [38416, 39160, 39936, 40948],
      Reaper: [38418, 39162, 39938, 40950],
      Sage: [38417, 39161, 39937, 40949],
    },
  },
  {
    key: 'phantom',
    name: 'Phantom Weapons',
    expansion: 'Dawntrail',
    stages: ['Penumbrae', 'Umbrae', 'Obscurum', 'Eclipticum', 'Occultum'],
    // Each weapon up to Eclipticum is traded for 3 of its stage's arcanite, 500 Mathematics each (on top of the stage's
    // one-time items, which aren't tracked). Names from https://ffxiv.consolegameswiki.com/wiki/Phantom_Weapons.
    // Occultum is a free exchange of the Eclipticum weapon, so it costs nothing and shares Eclipticum's column.
    costs: ['Arcanite', 'Waxing Arcanite', 'Waning Arcanite', 'Ecliptic Arcanite'].map((item) => viaItem('Mathematics', item, 3, 500)),
    joinedStages: [4],
    weapons: {
      Paladin: [47869, 47006, 50032, 50978, 51000],
      Warrior: [47871, 47008, 50034, 50980, 51002],
      WhiteMage: [47874, 47011, 50037, 50983, 51005],
      Scholar: [47877, 47014, 50040, 50986, 51008],
      Monk: [47870, 47007, 50033, 50979, 51001],
      Dragoon: [47872, 47009, 50035, 50981, 51003],
      Ninja: [47878, 47015, 50041, 50987, 51009],
      Bard: [47873, 47010, 50036, 50982, 51004],
      BlackMage: [47875, 47012, 50038, 50984, 51006],
      Summoner: [47876, 47013, 50039, 50985, 51007],
      DarkKnight: [47879, 47016, 50042, 50988, 51010],
      Astrologian: [47881, 47018, 50044, 50990, 51012],
      Machinist: [47880, 47017, 50043, 50989, 51011],
      Samurai: [47882, 47019, 50045, 50991, 51013],
      RedMage: [47883, 47020, 50046, 50992, 51014],
      Gunbreaker: [47884, 47021, 50047, 50993, 51015],
      Dancer: [47885, 47022, 50048, 50994, 51016],
      Reaper: [47886, 47023, 50049, 50995, 51017],
      Sage: [47887, 47024, 50050, 50996, 51018],
      Viper: [47888, 47025, 50051, 50997, 51019],
      Pictomancer: [47889, 47026, 50052, 50998, 51020],
    },
  },
]

export const relicSeries: readonly RelicSeries[] = series.map((s) => ({ ...s, jobs: Object.keys(s.weapons) }))
