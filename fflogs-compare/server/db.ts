import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const DB_PATH = process.env.DB_PATH ?? './data/app.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`)

// Append-only: each entry runs once, in order, tracked by PRAGMA user_version.
// Never edit a migration that has shipped; add a new one instead.
const migrations: string[] = [
  // 1: initial schema
  `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  -- Only the SHA-256 of the session token is stored, so a leaked DB can't be used to log in
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- One row per gear slot that has been touched; missing rows mean the default status
  CREATE TABLE IF NOT EXISTS bis_slots (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job        TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    status     TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, job, slot_index)
  );
  `,
  // 2: social logins. password_hash becomes nullable (Google-only users have none);
  // SQLite can't drop NOT NULL in place, so the table is rebuilt.
  `
  CREATE TABLE users_new (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    created_at    INTEGER NOT NULL
  );
  INSERT INTO users_new SELECT id, username, password_hash, created_at FROM users;
  DROP TABLE users;
  ALTER TABLE users_new RENAME TO users;

  CREATE TABLE oauth_accounts (
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email            TEXT,
    created_at       INTEGER NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
  );
  `,
  // 3: linked gear sets. Jobs with the same group_id share BiS progress; unlinked jobs have no row.
  // group_id is only meaningful per user.
  `
  CREATE TABLE job_links (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job      TEXT NOT NULL,
    group_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, job)
  );
  `,
  // 4: linking per slot instead of per job. A slot's link group is (slot_index, group_id):
  // jobs with the same pair share that slot. Existing job links become links on all slots.
  `
  CREATE TABLE slot_links (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job        TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    group_id   INTEGER NOT NULL,
    PRIMARY KEY (user_id, job, slot_index)
  );
  INSERT INTO slot_links (user_id, job, slot_index, group_id)
    WITH RECURSIVE slot(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM slot WHERE i < 9)
    SELECT l.user_id, l.job, slot.i, l.group_id FROM job_links l CROSS JOIN slot;
  DROP TABLE job_links;
  `,
  // 5: per-user UI settings (e.g. the dashboard layout), one JSON value per key
  `
  CREATE TABLE user_settings (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
]

// node:sqlite has no transaction helper; synchronous fn only, so nothing else can interleave
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number }

if (current < migrations.length) {
  // Off for the duration so table rebuilds don't cascade-delete; can't be toggled inside a transaction
  db.exec('PRAGMA foreign_keys = OFF')
  for (let version = current + 1; version <= migrations.length; version++) {
    db.exec('BEGIN')
    try {
      db.exec(migrations[version - 1]!)
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  db.exec('PRAGMA foreign_keys = ON')

  const violations = db.prepare('PRAGMA foreign_key_check').all()
  if (violations.length) throw new Error(`Foreign key violations after migration: ${JSON.stringify(violations)}`)
}
