# Synapse Core

A Soroban transaction-lifecycle dashboard built with Next.js 16 and React 19.
Synapse Core lets you inspect, trace, and drive transactions through a Soroban
smart contract deployed on Stellar Testnet — from registration through
completion or failure.

> **Current state: real wallet + contract calls, mock data as fallback.**
> Connect a Freighter or xBull wallet and every action (admin functions, transaction
> lifecycle actions, callback registration, diagnostics) submits a real signed
> transaction or read-only simulation against `NEXT_PUBLIC_CONTRACT_ID`. Without a
> connected wallet or a configured contract, the dashboard and transaction list fall
> back to `lib/mock-data.ts` so the UI is still explorable. A standalone backend relay
> service is still tracked in the open issues below.

---

## What's inside

```
synapse-web/
├── app/
│   ├── layout.tsx          # Root layout — metadata, ToastProvider, global CSS
│   ├── page.tsx            # Entry point — renders <Shell />
│   ├── globals.css         # Base styles, scanline overlay, utility classes
│   └── error.tsx / not-found.tsx
├── components/
│   ├── Shell.tsx           # Top-level shell: header, tab bar, footer
│   ├── command-palette/
│   │   └── CommandPalette.tsx      # Cmd/Ctrl+K fuzzy-searchable command list
│   ├── dashboard/
│   │   ├── DashboardTab.tsx        # Composes the dashboard view
│   │   ├── StatCards.tsx           # PENDING / PROCESSING / COMPLETED / FAILED counts
│   │   ├── Pipeline.tsx            # Visual pipeline of tx status flow
│   │   ├── ContractInfoPanel.tsx   # Contract address, admin, relay signer, health
│   │   └── RecentTxTable.tsx       # Last-N transactions with click-to-detail
│   ├── transactions/
│   │   ├── TransactionsTab.tsx     # Full transaction list with filters
│   │   ├── TxTable.tsx             # Sortable/paginated tx table
│   │   └── TxDetailModal.tsx       # Overlay with full tx fields
│   ├── admin/
│   │   └── AdminTab.tsx    # initialize / transfer_admin / set_relay_signer / diagnostics
│   ├── docs/
│   │   └── DocsTab.tsx     # ABI reference rendered from lib/constants.ABI_ENDPOINTS
│   └── ui/
│       ├── ActionButton.tsx
│       ├── Badge.tsx
│       ├── ConfirmDialog.tsx
│       ├── CopyButton.tsx
│       ├── Field.tsx
│       ├── Panel.tsx
│       ├── SorobanTip.tsx
│       ├── TabErrorBoundary.tsx
│       └── Toast.tsx
├── e2e/                  # Playwright specs (smoke + cross-engine runtime)
├── lib/
│   ├── mock-data.ts        # Fallback data: MOCK_TXS + MOCK_CONTRACT_INFO
│   ├── types.ts            # Transaction, ContractInfo, TxStatus, CallbackPayload
│   ├── constants.ts        # STATUS_META, colour tokens, ABI_ENDPOINTS
│   ├── utils.ts            # Shared helpers (shortId, elapsed, formatAmount)
│   ├── wallet/
│   │   ├── kit.ts              # StellarWalletsKit init (Freighter + xBull)
│   │   ├── storage.ts          # Selected-wallet-id localStorage helpers
│   │   └── WalletProvider.tsx  # useWallet() context: address/connect/disconnect
│   └── soroban/
│       ├── args.ts               # addressArg/stringArg/structArg ScVal encoders
│       ├── contract.ts           # invokeContract / simulateContractCall
│       ├── events.ts             # RPC event poller (TransactionRegistered/StatusChanged)
│       ├── SorobanProvider.tsx   # useSorobanEvents()/useSorobanHealth() context
│       ├── transactionMerge.ts   # Merges mock baseline with live events
│       ├── useLiveTransactions.ts
│       └── useLiveContractInfo.ts
└── public/                 # Static assets
```

### Mock data as fallback

`lib/mock-data.ts` exports the baseline data every tab renders when no wallet is
connected or `NEXT_PUBLIC_CONTRACT_ID` isn't configured:

| Export               | Used by                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `MOCK_TXS`           | `useLiveTransactions` baseline (stat cards, pipeline, tables)                  |
| `MOCK_CONTRACT_INFO` | `useLiveContractInfo` baseline (address, admin, relay_signer, health, version) |

Once a wallet is connected and a contract is configured, live RPC events and reads
take over — see `lib/soroban/transactionMerge.ts` and `lib/soroban/useLiveContractInfo.ts`.

---

## Runtime Contract Switcher & Multi-Deployment Tracking

The dashboard allows tracking and switching between multiple deployed Soroban contract IDs at runtime (for example, switching between a personal Testnet deployment and a shared staging deployment) without requiring environment changes or frontend rebuilds.

### Features
- **Contract-Switcher UI**: Integrated directly into the shell header with dropdown navigation, tracked deployments list, active badge indicators, and "+ ADD CONTRACT ID" form.
- **LocalStorage Persistence**: Contract selections and custom added deployments are persisted across browser reloads via `localStorage` (matching the pattern in `lib/wallet/storage.ts`).
- **Clean Re-scoping & Zero Stale-Data Leakage**:
  - Switching contracts tears down the existing `lib/soroban/events.ts` poller and establishes a fresh one scoped to the new contract ID.
  - Event poller cursors in `localStorage` are scoped per contract ID (`soroban-event-cursor:<contractId>`), ensuring event feeds never collide.
  - `useLiveTransactions` immediately wipes cached enrichment state and resets fetch registries upon contract switch.
  - `useLiveContractInfo` immediately wipes previous live health/version state and cancels any pending in-flight read requests.
  - `AdminTab`, `TransactionsTab`, and `TxDetailModal` automatically route all simulations and contract invocations to the active contract ID.

### Demonstration: Switching Live Between Two Testnet Instances
1. **Initial Contract A (Shared Testnet)**:
   - Select or configure Contract A: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.
   - The contract info panel reflects Contract A's address and simulated `health()`/`version()`.
   - Live events from Contract A are streamed into the pipeline and transaction tables.
2. **Switching to Contract B (Personal Testnet)**:
   - Click the **CONTRACT: ...** switcher in the header.
   - Click **+ ADD CONTRACT ID** and enter Contract B: `CA3D5KRYMCMCZKPO722ECQQQ3QHOFGT2TJNITW5OECVOAQCEK7ALISVN` with label `Personal Testnet`.
   - Click **Save & Switch**.
   - Contract A's event poller is torn down and stopped immediately.
   - All displayed events and enriched transaction state from Contract A are flushed to avoid stale leakage.
   - Poller for Contract B connects with its own scoped cursor and starts polling Contract B.
   - Contract info panel switches to Contract B, resetting old fields and re-fetching `health()` and `version()` for Contract B.
   - Your selection is remembered in `localStorage` on page reload.

---

## Getting started

**Requires Node `20.20.2` and npm `10.8.2` — exactly.** Those are the versions the
build is pinned to; CI runs nothing else, and `npm ci` with a different npm produces
a different tree.

The pin lives in `package.json` → `engines` and is mirrored in `.nvmrc`. With
[`nvm`](https://github.com/nvm-sh/nvm):

```bash
nvm install     # reads .nvmrc
nvm use
node --version  # v20.20.2
npm --version   # 10.8.2
```

Then:

```bash
npm ci
npm run dev
```

`npm ci` rather than `npm install`: it installs exactly what `package-lock.json`
pins and never rewrites the lockfile, which is what makes a local build match CI.

If your version is wrong the toolchain check tells you so immediately, rather than
letting it surface later as a confusing build error:

```bash
npm run check:toolchain
```

Upgrading the pinned version means changing `package.json` → `engines` and `.nvmrc`
together (the check fails if they disagree), then running `npm install` with the new
npm to regenerate `package-lock.json` and committing that too.

### The Docker dev environment uses the same pin

`npm run check:toolchain` also verifies any `Dockerfile` in the repository pins the
same Node (`FROM node:20.20.2`), so the container dev environment cannot quietly run
a different Node from CI. Until a Dockerfile exists the check reports a skip; when
one is added, a mismatch fails immediately.

Open [http://localhost:3000](http://localhost:3000). The app starts on the
**dashboard** tab. Connect a Freighter or xBull wallet and use the runtime **CONTRACT** switcher in the header (or configure `NEXT_PUBLIC_CONTRACT_ID` / `NEXT_PUBLIC_SOROBAN_RPC_URL` in `.env.local`) to interact with live Testnet contracts.

Other scripts:

```bash
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Run the test suite once
npm run test:unit        # Unit tests only (what the pre-push hook runs)
npm run test:watch       # Run the test suite in watch mode
npm run check:toolchain  # Assert Node/npm match the pin in package.json
npm run e2e:install      # One-time: download the Playwright browsers
npm run e2e              # Playwright suite (all three engines)
npm run format           # Prettier (writes)
npm run format:check     # Prettier (CI check)
```

### Lighthouse reports

`lighthouserc.js` + `.github/workflows/lighthouse.yml` audit all four tab routes
on every PR and post a browsable per-route report as a workflow artifact, with
deltas against the merge base. Locally, against a running dev server:

```bash
npx @lhci/cli@0.14.0 autorun --config=lighthouserc.js
node scripts/lighthouse-report.mjs .lighthouseci/manifest.json "" .lighthouseci/report
```

---

## Testing

Two suites, two runners, two jobs:

| Suite          | Runner         | Where                                | Scope                                                                         |
| -------------- | -------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `npm run test` | Vitest + jsdom | `*.test.ts(x)` next to their modules | Logic and component behaviour. Node 20 **and** 22 in CI.                      |
| `npm run e2e`  | Playwright     | `e2e/*.spec.ts`                      | Does the built app boot and render in each engine? Chromium, Firefox, WebKit. |

`e2e/` is excluded from Vitest's `include` globs (see `vitest.config.ts`) — both
runners default to `*.spec.ts`, so without that exclusion the Playwright suite
would be collected by `npm run test` and fail on a missing runner.

`playwright.config.ts` defines the browser matrix as Playwright `projects`. A
local `npm run e2e` runs all three; CI runs one project per matrix leg
(`npx playwright test --project=<engine>`) so a failure is attributable to a
specific engine.

The e2e suite builds and starts the production app (`next build && next start`)
rather than the dev server, so it exercises what actually ships. That build is
the dominant cost of the suite — budget ~1 minute of setup per run.

The pinned build/publish path stays on Node 20; only the _test_ job is matrixed
across Node versions. See `.github/workflows/ci.yml` for the reasoning.

```bash
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Run the test suite once
npm run test:unit        # Unit tests only (what the pre-push hook runs)
npm run test:watch       # Run the test suite in watch mode
npm run check:toolchain  # Assert Node/npm match the pin in package.json
npm run format           # Prettier (writes)
npm run format:check     # Prettier (CI check)
```

---



---

## Adding a new tab

1. Create `components/<name>/<Name>Tab.tsx` and export a `<NameTab />` component.
2. Add the tab key to the `TABS` array in `lib/tabs.ts`.
3. Add a matching `{tab === "<name>" && <NameTab />}` render block in `Shell.tsx`.
4. Wrap it in `<TabErrorBoundary>` like the existing tabs.

`lib/tabs.ts` is the single source of truth: the `/[tab]` route segment
prerenders one static page per entry, and `lighthouserc.js` audits the same
list. `lib/tabs.test.ts` fails CI if the two ever disagree, so a new tab cannot
ship without being added to the Lighthouse route list.

Each tab is a real URL — `/dashboard`, `/transactions`, `/admin`, `/docs` — so it
can be linked, bookmarked, and restored on reload. `/` stays canonical for the
dashboard.

---

## Deploy rollback automation

`.github/workflows/rollback.yml` rolls production back to the last known-good build
when health signals (error rate, synthetic-monitoring failures) breach configured
thresholds inside the observation window of a new deploy. Rolling back is "serve the
previous build" — the app is stateless, so there is no data migration to unwind.

Thresholds, hooks and the manual force/prevent overrides are all configuration, not
code. See **[docs/rollback.md](docs/rollback.md)** for the full contract: which
repository variables and secrets to set, the health-signal payload shape, how to wire
the deploy pipeline's `deploy_completed` dispatch, and the anti-flap circuit breaker
that stops rollback/re-promote loops.

The decision logic itself lives in `scripts/deploy/rollback-policy.mjs` and is
covered by `scripts/deploy/rollback-policy.test.ts`, so it is testable without a
deploy platform.

---

## Roadmap / open issues

Remaining backend and contract-ABI work is tracked in the upstream repo's issue
tracker:

- [Synapse-bridgez/synapse-web — open issues](https://github.com/Synapse-bridgez/synapse-web/issues)

Notable milestones on the path to a working testnet client:

- [x] Replace `alert()` stubs across `AdminTab`, `TxDetailModal`, and `TransactionsTab` with real
      `TransactionBuilder` + sign + submit calls (`lib/soroban/contract.ts`)
- [x] Wire `MOCK_TXS` / `MOCK_CONTRACT_INFO` to live `rpc.Server` reads (`useLiveTransactions`,
      `useLiveContractInfo`), falling back to mock data when no wallet/contract is configured
- [x] Integrate `@creit.tech/stellar-wallets-kit` (Freighter / xBull) for wallet connection
      (`lib/wallet/`)
- [x] Command palette (`Cmd/Ctrl+K`) for tab navigation, key actions, and settings toggles
      (`components/command-palette/CommandPalette.tsx`)
- [ ] Backend relay service for `register_transaction`, `start_processing`, `complete_transaction`,
      `fail_transaction`, and `register_callback` webhooks
- [ ] Fetch `admin` / `relay_signer` from the deployed contract once it exposes a getter for them
      (currently sourced from `lib/mock-data.ts` / env, since the ABI has none)

---

## Tech stack

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router)                                              |
| UI             | React 19, inline styles + Tailwind CSS v4                            |
| Font           | IBM Plex Mono                                                        |
| Language       | TypeScript 5                                                         |
| Linting        | ESLint + Prettier + Husky pre-commit / pre-push                      |
| Testing        | Vitest + Testing Library (unit), Playwright (E2E)                    |
| CI             | GitHub Actions — Node 20/22 test matrix, Chromium/Firefox/WebKit E2E |
| Target network | Stellar Testnet (Soroban)                                            |
