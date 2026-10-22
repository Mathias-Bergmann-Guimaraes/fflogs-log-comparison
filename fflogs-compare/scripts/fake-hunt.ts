// Pushes a made-up train announcement to /api/hunts/ingest, the way the forwarding bot would, to try the Hunt pages
// without waiting for a real one. Needs HUNT_INGEST_SECRET in .env and the server running.
//   npm run fake-hunt -- --world Odin --marks 14/12 --in 5 --role 934264593470070784
//   npm run fake-hunt -- --all          (one train per expansion: 7.0, 6.0, 5.0 and Old)
//   npm run fake-hunt -- --delete <message id>
import { parseArgs } from 'node:util'

// What --all sends: the hunt server's real role for each expansion, which show as that expansion once named
// "7.0", "6.0", "5.0" and "Old" under Name pings on the A-Rank page.
const ALL_TRAINS = [
  { type: '7.0', role: '1255412015757918240', world: 'Zodiark', at: 'Yyasulani Station - Heritage Found - Instance 1' },
  { type: '6.0', role: '934264593470070784', world: 'Odin', at: 'Aporia - Labyrinthos' },
  { type: '5.0', role: '934264458069561354', world: 'Omega', at: 'Fort Jobb - Lakeland' },
  { type: 'Old', role: '1091904124301353110', world: 'Phoenix', at: 'Castrum Oriens - The Fringes' },
]

const { values: args } = parseArgs({
  options: {
    world: { type: 'string', default: 'Zodiark' },
    // Minutes until the train starts; negative for one that already started
    in: { type: 'string', default: '10' },
    // "14/12", or "none" for a post without a count
    marks: { type: 'string', default: '12/12' },
    // Role pinged; the A-Rank page's ping names decide which expansion it is (this one is Dawntrail there)
    role: { type: 'string', default: '1255412015757918240' },
    at: { type: 'string', default: 'Yyasulani Station - Heritage Found - Instance 1' },
    conductor: { type: 'string', default: '[Shiva] Test Conductor' },
    channel: { type: 'string', default: 'light-trains' },
    all: { type: 'boolean', default: false },
    delete: { type: 'string' },
    url: { type: 'string', default: `http://localhost:${process.env.PORT ?? 3000}/api/hunts/ingest` },
  },
})

const secret = process.env.HUNT_INGEST_SECRET
if (!secret) throw new Error('HUNT_INGEST_SECRET is not set (run through npm run fake-hunt, which loads .env)')
const headers = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status} ${await res.text()}`)
}

// A Discord id encodes when it was made, and that's what the server stores as the post time
const DISCORD_EPOCH = 1420070400000n
const newId = () => (((BigInt(Date.now()) - DISCORD_EPOCH) << 22n) | BigInt(Math.floor(Math.random() * 4096))).toString()

async function sendTrain(train: { role: string; world: string; at: string }) {
  const id = newId()
  const startsAt = Math.round(Date.now() / 1000 + Number(args.in) * 60)
  const marks = args.marks === 'none' ? '' : ` ${args.marks} marks`
  const content =
    `<@&${train.role}> **[${train.world}]** Hunt train starting <t:${startsAt}:R> at ${train.at}${marks} (Conductor: ${args.conductor}).`

  await send('POST', args.url, {
    id,
    channel_id: '754553224291155989',
    channel_name: args.channel,
    type: 0,
    content,
    author: { id: '1', username: 'fake-hunt' },
    embeds: [],
    attachments: [],
  })
  return { id, content }
}

if (args.delete) {
  // Several ids at once too: --delete "id1 id2"
  for (const id of args.delete.split(/[\s,]+/).filter(Boolean)) {
    await send('DELETE', `${args.url}/${id}`)
    console.log(`Deleted ${id}`)
  }
} else if (args.all) {
  const ids: string[] = []
  for (const train of ALL_TRAINS) {
    const { id } = await sendTrain(train)
    ids.push(id)
    console.log(`Sent ${train.type} on ${train.world}: ${id}`)
  }
  console.log(`Remove them with: npm run fake-hunt -- --delete "${ids.join(' ')}"`)
} else {
  const { id, content } = await sendTrain({ role: args.role, world: args.world, at: args.at })
  console.log(`Sent ${id}:\n${content}\nRemove it with: npm run fake-hunt -- --delete ${id}`)
}
