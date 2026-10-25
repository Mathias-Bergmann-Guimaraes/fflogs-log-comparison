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
  // 6: where the slot's BiS piece comes from ('raid' or 'tome'), so an acquired slot still knows which piece it is.
  // Already-acquired slots can't be told apart and stay 'raid'.
  `
  ALTER TABLE bis_slots ADD COLUMN source TEXT NOT NULL DEFAULT 'raid';
  UPDATE bis_slots SET source = 'tome' WHERE status IN ('tome', 'twine', 'glaze');
  `,
  // 7: hunt messages copied from a Discord channel (server/hunts.ts). Shared by all users, not per user.
  // id is the Discord snowflake; created_at is derived from it. embeds/attachments/pings are JSON arrays.
  `
  CREATE TABLE hunt_messages (
    id          TEXT PRIMARY KEY,
    author_name TEXT NOT NULL,
    author_icon TEXT,
    content     TEXT NOT NULL,
    embeds      TEXT NOT NULL,
    attachments TEXT NOT NULL,
    pings       TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    edited_at   INTEGER
  );
  CREATE INDEX hunt_messages_created ON hunt_messages (created_at DESC);
  `,
  // 8: which Discord channel a hunt message came from. channel_name is whatever the pushing bot sends along
  // (raw Discord messages only carry the id); both are null for messages stored before this.
  `
  ALTER TABLE hunt_messages ADD COLUMN channel_id TEXT;
  ALTER TABLE hunt_messages ADD COLUMN channel_name TEXT;
  `,
  // 9: custom gear sets (e.g. an ultimate's older gear) next to the default one. BiS progress and links get a set_id:
  // 0 is the default set (no gear_sets row), anything else a gear_sets id. item_id pins the slot's piece to a
  // specific item; null means the piece is worked out from the set's item level range (or this tier's gear for set 0).
  // Both tables are rebuilt, since set_id joins their primary keys.
  `
  CREATE TABLE gear_sets (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    jobs       TEXT NOT NULL,
    min_ilvl   INTEGER NOT NULL,
    max_ilvl   INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE bis_slots_new (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    set_id     INTEGER NOT NULL DEFAULT 0,
    job        TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    status     TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'raid',
    item_id    INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, set_id, job, slot_index)
  );
  INSERT INTO bis_slots_new (user_id, job, slot_index, status, source, updated_at)
    SELECT user_id, job, slot_index, status, source, updated_at FROM bis_slots;
  DROP TABLE bis_slots;
  ALTER TABLE bis_slots_new RENAME TO bis_slots;

  CREATE TABLE slot_links_new (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    set_id     INTEGER NOT NULL DEFAULT 0,
    job        TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    group_id   INTEGER NOT NULL,
    PRIMARY KEY (user_id, set_id, job, slot_index)
  );
  INSERT INTO slot_links_new (user_id, job, slot_index, group_id) SELECT user_id, job, slot_index, group_id FROM slot_links;
  DROP TABLE slot_links;
  ALTER TABLE slot_links_new RENAME TO slot_links;
  `,
  // 10: features only some accounts get (e.g. the Hunt Tracker), switched on per user from the admin page
  // (server/admin.ts). A row means the feature is on; the names are FEATURES in server/features.ts.
  `
  CREATE TABLE user_features (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature    TEXT NOT NULL,
    enabled_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, feature)
  );
  `,
  // 11: our own copy of the S rank posts' maps (server/hunts.ts). Discord's image links are signed and expire after
  // about a day, so the image is fetched while the link is fresh and served from here. One per S rank and spawn
  // point (key: see imageKey), shared by every post of it, so there are only ever as many as there are spawn points.
  `
  CREATE TABLE hunt_images (
    key          TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL,
    fetched_at   INTEGER NOT NULL
  );
  `,
  // 12: the Fashion Report guide images (server/fashion.ts), kept for the same reason. id is the Discord message's.
  `
  CREATE TABLE fashion_reports (
    id           TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL,
    posted_at    INTEGER NOT NULL,
    fetched_at   INTEGER NOT NULL
  );
  `,
  // 13: data a game plugin sends (server/plugin.ts). The plugin logs in with a token made on the Settings page; only
  // its SHA-256 is stored, like sessions. Snapshots keep the latest of each kind per character (character_id: the
  // game's content id); events are appended, and only the newest are kept. data is JSON (src/types/plugin.ts).
  // An event's client_id is the plugin's own id for it, so a resent event isn't stored twice (null when it has none).
  `
  CREATE TABLE plugin_tokens (
    id           INTEGER PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    last_used_at INTEGER
  );

  CREATE TABLE plugin_snapshots (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL,
    kind         TEXT NOT NULL,
    data         TEXT NOT NULL,
    captured_at  INTEGER NOT NULL,
    received_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, character_id, kind)
  );

  CREATE TABLE plugin_events (
    id           INTEGER PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL,
    type         TEXT NOT NULL,
    client_id    TEXT,
    data         TEXT NOT NULL,
    occurred_at  INTEGER NOT NULL,
    received_at  INTEGER NOT NULL,
    UNIQUE (user_id, client_id)
  );
  CREATE INDEX plugin_events_user ON plugin_events (user_id, occurred_at DESC);
  `,
  // 14: characters claimed through the Lodestone (server/characters.ts). A claim is verified by finding the account's
  // code in the character's Lodestone profile text; a character belongs to one account at a time, so verifying it
  // again from another account moves it there. name and world are as the Lodestone showed them at the last check.
  // fflogs = 1 marks the account's FF Logs character (at most one per account), found on FF Logs by its Lodestone id.
  // claim_codes holds the codes handed out and not used yet, one per account and character.
  `
  CREATE TABLE character_claims (
    lodestone_id TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    world        TEXT NOT NULL,
    data_center  TEXT,
    verified_at  INTEGER NOT NULL,
    fflogs       INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX character_claims_user ON character_claims (user_id);
  CREATE UNIQUE INDEX character_claims_fflogs ON character_claims (user_id) WHERE fflogs = 1;
  CREATE INDEX character_claims_name ON character_claims (name COLLATE NOCASE, world COLLATE NOCASE);

  CREATE TABLE claim_codes (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lodestone_id TEXT NOT NULL,
    name         TEXT NOT NULL,
    world        TEXT NOT NULL,
    data_center  TEXT,
    code         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (user_id, lodestone_id)
  );
  `,
  // 15: the character's Lodestone portrait (its img2.finalfantasyxiv.com link), the site's avatar for its account.
  // Null for claims made before this until they're refreshed from the Lodestone.
  `
  ALTER TABLE character_claims ADD COLUMN avatar TEXT;
  ALTER TABLE claim_codes ADD COLUMN avatar TEXT;
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
