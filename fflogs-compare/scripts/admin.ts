// The admin page's main jobs from a shell on the server, without opening a tunnel:
//   npm run admin -- users
//   npm run admin -- enable <username> <feature>
//   npm run admin -- disable <username> <feature>
// Uses the same DB_PATH as the server; fine to run while it's up (SQLite in WAL mode).
import { db } from '../server/db.ts'
import { FEATURES, isFeature, setFeature, userFeatures } from '../server/features.ts'

const [command, username, feature] = process.argv.slice(2)

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

if (command === 'users') {
  const users = db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at').all() as {
    id: number
    username: string
    created_at: number
  }[]
  console.table(
    users.map((u) => ({
      username: u.username,
      created: new Date(u.created_at).toISOString().slice(0, 10),
      features: userFeatures(u.id).join(', '),
    })),
  )
} else if (command === 'enable' || command === 'disable') {
  if (!username || !isFeature(feature)) fail(`Usage: npm run admin -- ${command} <username> <${FEATURES.join('|')}>`)
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username) as { id: number; username: string } | undefined
  if (!user) fail(`No user named ${username}`)
  setFeature(user.id, feature, command === 'enable')
  console.log(`${feature} ${command}d for ${user.username}`)
} else {
  fail(`Usage: npm run admin -- users | enable <username> <feature> | disable <username> <feature>\nFeatures: ${FEATURES.join(', ')}`)
}
