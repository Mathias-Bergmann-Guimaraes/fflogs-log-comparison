// Pushes a made-up S rank report to /api/hunts/ingest, shaped like Faloop's bot posts, to try the Hunt Dashboard's
// S rank cards without waiting for a real one. Needs HUNT_INGEST_SECRET in .env and the server running.
//   npm run fake-srank -- --world Odin --mark "Kirlirger the Abhorrent" --zone Urqopacha --expansion 7 --spot "Wachunpelo|28.1, 22.4"
//   npm run fake-srank -- --ss          (an SS rank; give --spot several times for several spawn points)
//   npm run fake-srank -- --all         (one per expansion, an SS among them)
//   npm run fake-srank -- --delete <message id>
// The map is XIVAPI's map of the zone when --map-id is given (the Map sheet's Id, e.g. y6f1/00), else no image.
import { parseArgs } from 'node:util'

// Faloop's emojis. Only the 2x, 4x and 7x ids are known from real posts; the others are made up, so on the
// notification pages those show as broken emoji images (the dashboard only reads the name).
const EMOJI = {
  smob: '849505065801613362',
  ssmob: '849505206898262026',
  aetheryte: '853106173112090644',
  expansion: {
    2: '1255303608258269304',
    3: '1000000000000000003',
    4: '1255303637752741989',
    5: '1000000000000000005',
    6: '1000000000000000006',
    7: '1255303681654521856',
  } as Record<number, string>,
}

// The S rank channels, by DC (their real ids, so the server already knows them as S rank channels)
const CHANNELS = {
  light: { id: '754491196134522952', name: 'light-s-ranks' },
  chaos: { id: '696835442796134481', name: 'chaos-s-ranks' },
}
const LIGHT_WORLDS = ['alpha', 'lich', 'odin', 'phoenix', 'raiden', 'shiva', 'twintania', 'zodiark']

type FakeSRank = {
  world: string
  mark: string
  zone: string
  expansion: number
  spots: string[]
  ss?: boolean
  mapId?: string
  spotter?: string
}

// What --all sends: one of each expansion's look, and an SS rank with several spawn points
const ALL_S_RANKS: FakeSRank[] = [
  { world: 'Zodiark', mark: 'Kirlirger the Abhorrent', zone: 'Urqopacha', expansion: 7, spots: ['Wachunpelo|28.1, 22.4'], mapId: 'y6f1/00', spotter: 'Test Spotter' },
  {
    world: 'Odin',
    mark: 'Arch Aethereater',
    zone: 'Urqopacha',
    expansion: 7,
    ss: true,
    spots: ['Wachunpelo|25.7, 13.9', 'Wachunpelo|18.3, 17.9', "Worlar's Echo|34.6, 28.2", "Worlar's Echo|15.6, 28.5"],
    mapId: 'y6f1/00',
  },
  { world: 'Omega', mark: 'Burfurlur the Canny', zone: 'Labyrinthos', expansion: 6, spots: ['The Archeion|21.0, 22.6'], mapId: 'k5f1/00', spotter: 'Test Spotter' },
  { world: 'Moogle', mark: 'Tyger', zone: 'Lakeland', expansion: 5, spots: ['Fort Jobb|24.6, 22.5'], mapId: 'n4f1/00' },
  { world: 'Phoenix', mark: 'Udumbara', zone: 'The Fringes', expansion: 4, spots: ['Castrum Oriens|24.2, 26.7'], mapId: 'g3f1/00' },
  { world: 'Cerberus', mark: 'The Garlok', zone: 'Eastern La Noscea', expansion: 2, spots: ['Wineport|17.0, 33.9'], mapId: 's1f3/01' },
]

const { values: args } = parseArgs({
  options: {
    world: { type: 'string', default: 'Zodiark' },
    mark: { type: 'string', default: 'Kirlirger the Abhorrent' },
    zone: { type: 'string', default: 'Urqopacha' },
    // 2 (ARR) to 7 (Dawntrail)
    expansion: { type: 'string', default: '7' },
    // "Aetheryte|x, y"; repeat for several spawn points
    spot: { type: 'string', multiple: true, default: ['Wachunpelo|28.1, 22.4'] },
    ss: { type: 'boolean', default: false },
    'map-id': { type: 'string', default: 'y6f1/00' },
    // "none" for a post Faloop sends without a spotter
    spotter: { type: 'string', default: 'Test Spotter' },
    all: { type: 'boolean', default: false },
    delete: { type: 'string' },
    url: { type: 'string', default: `http://localhost:${process.env.PORT ?? 3000}/api/hunts/ingest` },
  },
})

const secret = process.env.HUNT_INGEST_SECRET
if (!secret) throw new Error('HUNT_INGEST_SECRET is not set (run through npm run fake-srank, which loads .env)')
const headers = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status} ${await res.text()}`)
}

// A Discord id encodes when it was made, and that's what the server stores as the post time
const DISCORD_EPOCH = 1420070400000n
const newId = () => (((BigInt(Date.now()) - DISCORD_EPOCH) << 22n) | BigInt(Math.floor(Math.random() * 4096))).toString()

async function sendSRank(s: FakeSRank) {
  const id = newId()
  const channel = LIGHT_WORLDS.includes(s.world.toLowerCase()) ? CHANNELS.light : CHANNELS.chaos
  const spotLines = s.spots.map((spot) => {
    const [aetheryte, coords] = spot.split('|')
    return ` <:aetheryte:${EMOJI.aetheryte}>   ${aetheryte?.trim()}  ⇒  ❌ **\`${coords?.trim() ?? '?'}\`**`
  })
  const description = [
    `### _ _🌍  ${s.world}`,
    `## <:${s.ss ? 'ssmob' : 'smob'}:${s.ss ? EMOJI.ssmob : EMOJI.smob}>  ${s.mark} `,
    `### _ _<:${s.expansion}x:${EMOJI.expansion[s.expansion] ?? '1000000000000000000'}>  ${s.zone} `,
    ...spotLines,
  ].join('\n')

  await send('POST', args.url, {
    id,
    channel_id: channel.id,
    channel_name: channel.name,
    type: 0,
    content: `[ ${s.world} ]  ${s.mark}`,
    author: { id: '1', username: 'fake-srank' },
    embeds: [
      {
        description,
        color: 5601721,
        footer: { text: s.spotter ? `📢  ${s.spotter}` : 'Faloop.app' },
        image: s.mapId ? { url: `https://v2.xivapi.com/api/asset/map/${s.mapId}?format=jpg` } : undefined,
      },
    ],
    attachments: [],
  })
  return { id, description }
}

if (args.delete) {
  // Several ids at once too: --delete "id1 id2"
  for (const id of args.delete.split(/[\s,]+/).filter(Boolean)) {
    await send('DELETE', `${args.url}/${id}`)
    console.log(`Deleted ${id}`)
  }
} else if (args.all) {
  const ids: string[] = []
  for (const s of ALL_S_RANKS) {
    const { id } = await sendSRank(s)
    ids.push(id)
    console.log(`Sent ${s.ss ? 'SS' : 'S'} rank ${s.mark} on ${s.world}: ${id}`)
  }
  console.log(`Remove them with: npm run fake-srank -- --delete "${ids.join(' ')}"`)
} else {
  const { id, description } = await sendSRank({
    world: args.world,
    mark: args.mark,
    zone: args.zone,
    expansion: Number(args.expansion),
    spots: args.spot,
    ss: args.ss,
    mapId: args['map-id'] === 'none' ? undefined : args['map-id'],
    spotter: args.spotter === 'none' ? undefined : args.spotter,
  })
  console.log(`Sent ${id}:\n${description}\nRemove it with: npm run fake-srank -- --delete ${id}`)
}
