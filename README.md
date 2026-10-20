# fflogs-log-comparison

A Vue 3 web app for comparing FFXIV combat logs: paste an [FF Logs](https://www.fflogs.com) report
URL, pick a player from the fight, and compare them against the world's top-ranked players of the
same job on the same encounter — DPS breakdowns (rDPS/aDPS/nDPS/cDPS), crit and direct-hit rates,
per-phase tables, and damage-over-time graphs.

The log comparison talks straight to the FF Logs v2 GraphQL API from the browser. A small API
server in [`fflogs-compare/server/`](fflogs-compare/server) (Hono + SQLite) handles user accounts
and stores each user's BiS tracker progress.

## Quick start

The app lives in [`fflogs-compare/`](fflogs-compare), one level down:

```sh
cd fflogs-compare
npm install
npm run dev
```

`npm run dev` first runs `npm run codegen` (offline, no credentials needed), then starts both Vite (default <http://localhost:5173>) and the API server on port 3000;
Vite proxies `/api` to it.

### Requirements

- **Node** `>=22.12.0` (enforced by `engines` in `package.json`). The server uses Node's built-in
  `node:sqlite`, which doesn't exist on Node 20.
- **FF Logs API client credentials (optional, but needed for the log comparison)** — create a v2
  client at <https://www.fflogs.com/api/clients/>, then put them in `fflogs-compare/.env`:

  ```ini
  VITE_FFLOGS_CLIENT_ID=your_client_id
  VITE_FFLOGS_CLIENT_SECRET=your_client_secret
  ```

  `.env` is gitignored, so every clone needs its own. Without them the app still loads and
  everything that doesn't talk to FF Logs (login, BiS tracker, hunts, ...) works; the log
  comparison page shows a "credentials not configured" notice instead of the report form. Vite
  reads `.env` at startup, so restart `npm run dev` after adding them.

- **Google login (optional)**: without these vars the "Continue with Google" button is hidden and
  username/password login still works. Create an OAuth client in Google Cloud Console (APIs &
  Services → Credentials → *Web application*), add
  `http://localhost:5173/api/auth/google/callback` (and your production URL's equivalent) as an
  authorised redirect URI, then add to the same `.env`:

  ```ini
  GOOGLE_CLIENT_ID=...apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=...
  # Public origin the browser uses; defaults to http://localhost:5173 (Vite in dev)
  APP_URL=https://yourdomain
  ```

  These have no `VITE_` prefix, so they're read only by the server and never bundled into the
  frontend. Set the OAuth consent screen to *In production*: in *Testing* only manually added test
  users can log in.

- **Hunt Tracker (optional)**: the *Hunt Tracker* page shows the messages of one Discord channel,
  stored by [`server/hunts.ts`](fflogs-compare/server/hunts.ts). Messages reach it in one of two
  ways:

  **Push (a bot that can see the channel sends them to us).** Set a long random secret:

  ```ini
  # At least 16 characters, e.g. from: node -e "console.log(crypto.randomUUID())"
  HUNT_INGEST_SECRET=...
  ```

  The bot sends Discord's raw message object, the `d` of a `MESSAGE_CREATE` or `MESSAGE_UPDATE`
  gateway event, with an `Authorization: Bearer <secret>` header:

  - `POST /api/hunts/ingest` with one message, or an array of them for a backfill. Sending a
    message again replaces it, which is how edits work.
  - `DELETE /api/hunts/ingest/<message id>` removes a deleted message.

  With discord.py, for example. It uses the raw gateway events, so the bot sends exactly what
  Discord sent:

  ```python
  import json
  import os

  import aiohttp

  # Channel IDs as strings: raw gateway data has them as strings, not ints
  HUNT_CHANNELS = {'...', '...'}
  INGEST_URL = 'http://localhost:3000/api/hunts/ingest'

  # enable_debug_events=True is what makes on_socket_raw_receive fire
  bot = commands.Bot(command_prefix='!', intents=intents, enable_debug_events=True)

  session: aiohttp.ClientSession | None = None

  async def send(method, path='', body=None):
      global session
      if session is None:
          session = aiohttp.ClientSession(headers={'Authorization': f"Bearer {os.environ['HUNT_INGEST_SECRET']}"})
      try:
          async with session.request(method, INGEST_URL + path, json=body) as res:
              if res.status >= 400:
                  print('Hunt ingest failed:', res.status, await res.text())
      except aiohttp.ClientError as e:
          print('Hunt ingest failed:', e)

  @bot.listen('on_socket_raw_receive')
  async def forward_hunts(msg):
      event = json.loads(msg)
      t, d = event.get('t'), event.get('d')
      if not isinstance(d, dict) or d.get('channel_id') not in HUNT_CHANNELS:
          return
      if t in ('MESSAGE_CREATE', 'MESSAGE_UPDATE'):
          # channel_name isn't part of Discord's message; it's what the page shows and filters by
          channel = bot.get_channel(int(d['channel_id']))
          await send('POST', body={**d, 'channel_name': channel.name if channel else None})
      elif t == 'MESSAGE_DELETE':
          await send('DELETE', f"/{d['id']}")
  ```

  `MESSAGE_UPDATE` can carry a partial message, such as an embed-only update. A partial without
  `author` is rejected with a 400, which is harmless.

  **Poll (we read the channel ourselves).** Set `DISCORD_BOT_TOKEN` and
  `DISCORD_HUNT_CHANNEL_ID`, and optionally `DISCORD_POLL_SECONDS` (default 20). This only works if
  your own bot is a member of the server holding the channel. Turn on **Message Content Intent** for
  it in the developer portal, or message text comes through empty.

  Messages from S rank channels are hidden 10 minutes after they were posted. They aren't deleted.
  A channel counts as S rank when its name contains "s-rank" (`chaos-s-ranks`) or starts with "S"
  plus a separator (`S Light`). It counts as A rank on the same rule with "a", or when the name
  contains "train" (`light-trains`). The rules are `RANK_PATTERNS` in `server/hunts.ts`, and they
  also decide what the EU A-Rank and EU S-Rank pages show. Change the time with `HUNT_S_RANK_MINUTES`.

  Either way, role pings come through as raw ids. Name them with the page's *Name pings* button.

  The *Train dashboard* page reads the A rank posts: the world is the first bracketed EU world in the
  text (`**[Twintania]** Hunt train starting …`), the start time is the post's `<t:…>` timestamp, and
  the expansion comes from the role ping. Name the expansion roles `7.0`, `6.0`, `5.0` and `Old` (or
  `Dawntrail`, `EW`, `ShB`, …; see `TRAIN_TYPES` in
  [`trains.ts`](fflogs-compare/src/views/hunts/dashboard/trains.ts)) for the dashboard to tell them apart.

> [!IMPORTANT]
> The generated file `src/api/__generated__/graphql.ts` is gitignored, and nothing type-checks or
> builds without it. `npm run dev` and `npm run build` regenerate it automatically (`predev` /
> `prebuild` hooks); to run `npm run type-check` or use the IDE on a fresh clone, run
> `npm run codegen` once. Codegen reads the committed schema snapshot
> [`schema.graphql`](fflogs-compare/schema.graphql), so it needs neither credentials nor network.
> Only `npm run schema:update`, which refreshes that snapshot from the live API, needs credentials.

## Scripts

Run all of these from `fflogs-compare/`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (HMR + Vue DevTools) and the API server in watch mode |
| `npm run codegen` | Regenerates `src/api/__generated__/graphql.ts` from `schema.graphql` (runs before `dev` and `build`) |
| `npm run schema:update` | Re-introspects the live FF Logs schema into `schema.graphql` (needs `.env` credentials) |
| `npm run build` | Type-check and production build (parallel, via `npm-run-all2`) |
| `npm run build-only` | Production build, skipping type-check |
| `npm run type-check` | `vue-tsc --build` |
| `npm run lint` | `oxlint --fix` then `eslint --fix` |
| `npm run format` | Prettier over `src/` |
| `npm run preview` | Serves the built `dist/` locally (no API, so login won't work) |
| `npm start` | Production server: API plus the built `dist/`, one process |

## Deploying

```sh
cd fflogs-compare
npm ci
npm run build   # runs codegen first
NODE_ENV=production PORT=3000 DB_PATH=/var/lib/ffxiv-companion/app.db npm start
```

- `DB_PATH` defaults to `./data/app.db` (gitignored). That one file is all the user data, so back it
  up (with WAL mode, copy it while the server is stopped, or use `sqlite3 app.db ".backup out.db"`).
- With `NODE_ENV=production` the session cookie is `Secure`, so serve over HTTPS (for example
  behind Caddy or nginx). Logins over plain HTTP won't stick.
- Run it under systemd, pm2, or similar so it restarts on crash and reboot.
- Set `APP_URL` to the public HTTPS origin, or Google will reject the redirect URI.
- `.env`'s FF Logs secret is still bundled into the frontend at build time; see Gotchas.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Vue 3 (`<script setup>`, Composition API) |
| Build | Vite 8 + TypeScript |
| State | Pinia |
| UI | Ant Design Vue 4 (dark theme) + Tailwind CSS 4 |
| Charts | ECharts 6 via `vue-echarts` (registered globally as `<VChart>`) |
| API types | GraphQL Code Generator (`typescript`, `typescript-operations`) |
| Lint/format | oxlint + ESLint + Prettier (no semicolons, single quotes, 150 cols) |

ECharts is tree-shaken: only the renderers, charts, and components listed in
[`src/main.ts`](fflogs-compare/src/main.ts) are registered. Using a new chart type means adding it
to that `use([...])` call.

## Project layout

```
fflogs-compare/
├─ codegen.ts                # GraphQL codegen config; reads schema.graphql
├─ schema.graphql            # committed FF Logs schema snapshot (refresh: npm run schema:update)
├─ vite.config.ts            # vue + devtools + tailwind plugins; '@' → ./src
├─ src/
│  ├─ main.ts                # app bootstrap: Pinia, router, Antd, ECharts registration
│  ├─ App.vue                # dark-theme config provider + <router-view>
│  ├─ api/
│  │  ├─ auth.ts             # OAuth2 client-credentials token fetch
│  │  ├─ fflogs.ts           # thin fetch wrapper: POSTs GraphQL, throws on body errors
│  │  ├─ useQuery.ts         # one typed wrapper function per .graphql document
│  │  ├─ queries/*.graphql   # the query documents themselves
│  │  └─ __generated__/      # codegen output (gitignored)
│  ├─ stores/
│  │  ├─ fflogsStore.ts      # the app's brain: fetching, caching, DPS math
│  │  └─ fflogsUtils.ts      # parseReportURL
│  ├─ types/fflogs.ts        # flattens nested codegen types into reusable aliases
│  ├─ constants/            # per-job damage constants (e.g. RDM drop-off)
│  ├─ assets/               # job icon PNGs + jobIcons.ts lookup, main.css
│  ├─ router/index.ts        # / → HomeView (landing), /compare → fflogsComparison/CompareView
│  └─ views/                 # HomeView (landing); fflogsComparison/: CompareView → PlayerPicker / TopPlayers → PlayerCard / BigPlayerCard
└─ .env                      # optional FF Logs / Google credentials (gitignored)
```

## How the API layer works

There is no GraphQL client library. The chain is deliberately thin:

1. [`auth.ts`](fflogs-compare/src/api/auth.ts) exchanges the client ID/secret for a bearer token
   via the OAuth 2.0 **client credentials** flow — no user login, public data only. The store
   caches the token and fetches it lazily on first use. It also exports `hasFFLogsCredentials`,
   which `CompareView` checks to show a notice instead of the form when the env vars are missing.
2. [`fflogs.ts`](fflogs-compare/src/api/fflogs.ts) POSTs `{ query, variables }` to
   `https://www.fflogs.com/api/v2/client`. FF Logs returns HTTP 200 even for GraphQL errors, so the
   wrapper inspects `json.errors` and throws.
3. `.graphql` files are imported as strings with Vite's `?raw` suffix and paired with their
   generated types in [`useQuery.ts`](fflogs-compare/src/api/useQuery.ts).
4. [`types/fflogs.ts`](fflogs-compare/src/types/fflogs.ts) unwraps the deeply nested generated
   shapes with index access (`ReportMetaQuery['reportData']['report']`) so they stay in sync with
   codegen automatically.

Codegen runs with `maybeValue: 'T'`, i.e. nullability is stripped from generated types. That is only
sound because the query layer throws on errors — a successful response won't carry null fields.

### Adding a query

1. Drop a new document in `src/api/queries/<name>.graphql`.
2. `npm run codegen` (offline). If the query uses fields newer than the snapshot, run
   `npm run schema:update` first (requires `.env` + network) and commit the new `schema.graphql`.
3. Add a typed wrapper in `src/api/useQuery.ts`.
4. Call it from `fflogsStore.ts`, caching the result by report code where it makes sense.

## State and caching

[`fflogsStore.ts`](fflogs-compare/src/stores/fflogsStore.ts) is a setup-style Pinia store. Report
metadata, players, fight events, summaries, and top-player rankings are all cached in records keyed
by **report code**, so navigating around doesn't re-spend API points. It also owns the DPS math:
`parseAllEvents` walks paginated damage events, `calcDPS` divides by combat time minus damage
downtime, and `curatePlayerSummary` turns raw table data into the numbers the cards display.

### Rate limits

FF Logs bills queries in **points per hour**. `rateLimitData` is queried alongside normal requests
and surfaced as a progress bar in [`CompareView.vue`](fflogs-compare/src/views/fflogsComparison/CompareView.vue) with a
reset countdown. Worth watching while developing — paginating events over a long fight is
expensive, and hitting the ceiling makes the app look broken until the hour rolls over.

## Gotchas

- **The report input needs a full URL, not a bare code.** The placeholder text in
  [`PlayerPicker.vue`](fflogs-compare/src/views/fflogsComparison/PlayerPicker.vue) says "paste report code", but
  [`parseReportURL`](fflogs-compare/src/stores/fflogsUtils.ts) runs `new URL(input)` and returns
  `{ code: "0", fightIDs: [] }` when that throws. Paste the whole
  `https://www.fflogs.com/reports/<code>?fight=1` URL; the `fight` param accepts `.`-separated IDs.
- **The client secret ships in the bundle.** Anything prefixed `VITE_` is inlined into the built JS
  by Vite. Fine for local development, but a public deployment would expose the FF Logs secret — a
  real deploy needs a small token-minting proxy instead.
- **Routing is shallow.** [`router/index.ts`](fflogs-compare/src/router/index.ts) has a landing page
  at `/` and the comparison page at `/compare`; navigation *within* the comparison (report → player →
  top players) is still component state inside `CompareView`, so it's lost on reload.
- **Leftovers.** `src/views/fflogsComparison/junk` and `junk2` are extensionless scratch files, and
  `src/stores/counter.ts` is the unused store from the Vue template. Nothing imports any of them.

## Editor setup

VS Code with the extensions in [`.vscode/extensions.json`](fflogs-compare/.vscode/extensions.json):
Vue (Official / Volar — disable Vetur), ESLint, EditorConfig, oxc, and Prettier. For
format-on-save, set Prettier as the default formatter and enable `source.fixAll` on save — the
local `.vscode/settings.json` does this, but it's gitignored, so a fresh clone won't have it.

Browser-side, the Vue DevTools extension plus "Custom Object Formatters" in DevTools makes Pinia
state and refs much easier to read.
