# fflogs-log-comparison

A Vue 3 web app for comparing FFXIV combat logs: paste an [FF Logs](https://www.fflogs.com) report
URL, pick a player from the fight, and compare them against the world's top-ranked players of the
same job on the same encounter — DPS breakdowns (rDPS/aDPS/nDPS/cDPS), crit and direct-hit rates,
per-phase tables, and damage-over-time graphs.

The app is a pure client-side SPA. It talks straight to the FF Logs v2 GraphQL API; there is no
backend of our own.

## Quick start

The app lives in [`fflogs-compare/`](fflogs-compare), one level down:

```sh
cd fflogs-compare
npm install
npm run codegen   # generates GraphQL types — needs .env, see below
npm run dev
```

Vite prints the local URL (default <http://localhost:5173>).

### Requirements

- **Node** `^20.19.0 || >=22.12.0` (enforced by `engines` in `package.json`)
- **FF Logs API client credentials** — create a v2 client at
  <https://www.fflogs.com/api/clients/>, then put them in `fflogs-compare/.env`:

  ```ini
  VITE_FFLOGS_CLIENT_ID=your_client_id
  VITE_FFLOGS_CLIENT_SECRET=your_client_secret
  ```

  `.env` is gitignored, so every clone needs its own.

> [!IMPORTANT]
> `npm run codegen` is **not** optional on a fresh clone. The generated file
> `src/api/__generated__/graphql.ts` is gitignored, and nothing type-checks or builds without it.
> Codegen introspects the **live** FF Logs schema, so it needs network access and valid
> credentials — [`codegen.ts`](fflogs-compare/codegen.ts) throws if either env var is missing.

## Scripts

Run all of these from `fflogs-compare/`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR + Vue DevTools |
| `npm run codegen` | Regenerates `src/api/__generated__/graphql.ts` from the live schema |
| `npm run build` | Type-check and production build (parallel, via `npm-run-all2`) |
| `npm run build-only` | Production build, skipping type-check |
| `npm run type-check` | `vue-tsc --build` |
| `npm run lint` | `oxlint --fix` then `eslint --fix` |
| `npm run format` | Prettier over `src/` |
| `npm run preview` | Serves the built `dist/` locally |

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
├─ codegen.ts                # GraphQL codegen config; fetches an OAuth token at config-parse time
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
│  ├─ router/index.ts        # / → HomeView (landing), /compare → CompareView
│  └─ views/                 # CompareView → PlayerPicker / TopPlayers → PlayerCard / BigPlayerCard
└─ .env                      # FF Logs credentials (gitignored)
```

## How the API layer works

There is no GraphQL client library. The chain is deliberately thin:

1. [`auth.ts`](fflogs-compare/src/api/auth.ts) exchanges the client ID/secret for a bearer token
   via the OAuth 2.0 **client credentials** flow — no user login, public data only. The store
   caches the token and fetches it lazily on first use.
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
2. `npm run codegen` (requires `.env` + network).
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
and surfaced as a progress bar in [`CompareView.vue`](fflogs-compare/src/views/CompareView.vue) with a
reset countdown. Worth watching while developing — paginating events over a long fight is
expensive, and hitting the ceiling makes the app look broken until the hour rolls over.

## Gotchas

- **The report input needs a full URL, not a bare code.** The placeholder text in
  [`PlayerPicker.vue`](fflogs-compare/src/views/PlayerPicker.vue) says "paste report code", but
  [`parseReportURL`](fflogs-compare/src/stores/fflogsUtils.ts) runs `new URL(input)` and returns
  `{ code: "0", fightIDs: [] }` when that throws. Paste the whole
  `https://www.fflogs.com/reports/<code>?fight=1` URL; the `fight` param accepts `.`-separated IDs.
- **The client secret ships in the bundle.** Anything prefixed `VITE_` is inlined into the built JS
  by Vite. Fine for local development, but a public deployment would expose the FF Logs secret — a
  real deploy needs a small token-minting proxy instead.
- **Routing is shallow.** [`router/index.ts`](fflogs-compare/src/router/index.ts) has a landing page
  at `/` and the comparison page at `/compare`; navigation *within* the comparison (report → player →
  top players) is still component state inside `CompareView`, so it's lost on reload.
- **Leftovers.** `src/views/junk` and `src/views/junk2` are extensionless scratch files, and
  `src/stores/counter.ts` is the unused store from the Vue template. Nothing imports any of them.

## Editor setup

VS Code with the extensions in [`.vscode/extensions.json`](fflogs-compare/.vscode/extensions.json):
Vue (Official / Volar — disable Vetur), ESLint, EditorConfig, oxc, and Prettier. For
format-on-save, set Prettier as the default formatter and enable `source.fixAll` on save — the
local `.vscode/settings.json` does this, but it's gitignored, so a fresh clone won't have it.

Browser-side, the Vue DevTools extension plus "Custom Object Formatters" in DevTools makes Pinia
state and refs much easier to read.
