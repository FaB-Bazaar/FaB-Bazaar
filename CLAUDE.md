# CLAUDE.md - FaB Bazaar

> Subdirectory CLAUDE.md files (e.g., `lib/auth/CLAUDE.md`, `lib/services/CLAUDE.md`) are loaded automatically when working in those directories. Don't read them proactively.

## Open Source Documentation Policy

This repo is publicly open-sourced. Keep CLAUDE.md content at the architecture/pattern level. Do not include error message strings, security-critical schema fields, token payload structures, or security implementation details.

## Project Overview

Next.js 15 (App Router) trading card platform for Flesh and Blood TCG. PostgreSQL + Drizzle ORM. Self-hosted VPS (Docker).

## Data Architecture

- **OLTP (live app)**: PostgreSQL — service-layer access only (see `lib/services`)
- **OLAP (daily analytics)**: DuckDB embedded in the Python pipeline. One file at `/app/data/prices.duckdb` in the pipeline container. No daemon, no separate service.
- **Reverse-ETL**: pipeline computes signals in DuckDB nightly, writes a small results table (`daily_movers`) back to Postgres. App reads from Postgres only — never touches DuckDB.
- See `pipeline/scripts/daily_pipeline.sh` for the full nightly flow.

## Security

- **Never hardcode secrets** — no API keys, tokens, passwords, or connection strings in source code. All secrets via `process.env.*` only, sourced from `.env.local` (never committed).

## Key Rules

- **Test-first for new features and bugfixes** — invoke the `/tdd` skill before writing implementation code. Watch the test fail (RED), write minimal code to pass (GREEN), then manual-test against the real runtime (dev server + curl for APIs, Playwright for UI). Tests-after produces suites that pass on first run and prove nothing about regressions. If you skipped TDD, say so explicitly and run a manual walkthrough before marking the work done.
- **Do not push to remote without an explicit request** — local commits at clean checkpoints are fine. `git push` (and force-pushes / PR creation / deploys) wait for the user to say "push", "deploy", or equivalent. Approval for one push does NOT carry over to the next.
- **PostgreSQL only** — MongoDB fully removed (2026-03-08). No Mongoose models, no MongoDB connections. The `models/` directory is dead code.
- **Don't modify auth middleware** — authentication is working and locked down
- **File locking** — many core files are locked and cannot be modified
- **Service layer for all DB access** — never query the database directly; use services from `@/lib/services`
- **Use `@/lib/fab-constants`** for card metadata (SET_MAP, FOILING_MAP, RARITY_MAP) — do NOT use metadataService
- **Use `@/lib/utils/display-username`** for rendered usernames — `displayUsername()` strips internal `dc_`/`gh_` prefixes (OAuth-provisional usernames; the prefix marks "never chose a name" and prevents collisions), `profileHref()` URL-encodes profile links. Discord bot commands still need raw usernames. MCP tools: stripped names in message text, raw `username` + `display_username` in structured data (see who_has).

## Deprecated/Removed Services

- `metadataService` — use `@/lib/fab-constants` instead
- `heroService` — removed; use `printingsService` + `@/lib/fab-constants/heroes` + `articleService`
- `binderStatsService` — removed; use `binderService.getUserBindersWithStats()`
- `denormalizationService` — removed (was MongoDB-only)
- `tradeMatchingService`, `tradeAnalysisService`, `matchingService` — deprecated
- Fabrary integration (`fabraryUrl`, `fabraryDeckId`) — removed from decks (0026)

## Known Gotchas

- **`/api/decks/list` is Talishar-only** — requires `x-api-key`; MCP and OAuth clients must use `/api/decks` (GET) instead.
- **Circular dep risk in services** — do not import from `@/lib/services` in any file that `lib/services/index.ts` imports transitively. Use `await import('@/lib/services')` lazily inside function bodies. (`lib/metafy/tokens.ts` hit this: caused `ReferenceError` in TDZ for `ServiceFactory`.)
- **Never run `drizzle-kit generate` / `npm run db:generate`** — the drizzle-kit journal (`lib/postgres/migrations/meta/_journal.json`) only tracks migrations 0000–0004. Running generate would diff against that stale snapshot and produce a massive destructive migration covering every hand-written migration from 0005 onward (latest is 0055+ as of this note). Always write SQL migration files manually (see any file in `lib/postgres/migrations/` from 0005 onward). They auto-apply on deploy via `scripts/run-migrations.sh` (tracked in the `_applied_migrations` table) — do NOT manually psql prod. Apply locally through the Docker DB (see lib/postgres/CLAUDE.md).
- **`isSystemDeck` on decks** — superadmin-owned "Decks to Beat" reference decks. Filtered out of all personal views (`listUserDecks`, `listUserDecksBasic`, Talishar sync, navbar, MCP). Still publicly accessible via URL and the Decks to Beat page. Toggle via `/api/decks/[deckId]/featured` PATCH (superadmin only).
- **Talishar DFC card identifiers** — double-faced cards (e.g. `"comet storm // shock"`) must export as `comet_storm__shock_red` (double underscore between faces). `toTalisharIdentifier` collapses `_+` — always split on ` // ` and join parts with `__` before appending pitch color. See `buildTalisharIdentifier` in `app/api/decks/[deckId]/talishar/route.ts`.
- **`createDeck` canonicalizes `hero_name`** — stores the resolved hero CARD's `display_name` (full adult/young name), overriding caller input (MCP enum, FaBrary "Hero:" line), on both the direct-create and `copyFromDeckId` paths. Don't rely on `hero_name` matching a caller's string; Talishar resolves from the hero card, not the string.
- **Major OP events = venue + event** — a Pro Tour / Calling / National is a `location` (category `venue`) plus an `event` row (`events.location_id` is NOT NULL). Add via the `create_event` MCP tool (superadmin; venue find-or-create built in) or `/admin/locations` → "Add event / venue" tab — not by direct DB writes.
- **History Pack set codes are `1hp`/`2hp`, not `hp1`/`hp2`** — "WB"/"Welcome Back" reprints. The legacy/community `hp1`/`hp2` spelling returns 0 results; `normalizeSetCode` (`lib/fab-constants/sets.ts`) aliases it for the shorthand parser + MCP structured filters. Don't hand-list set codes — the MCP constants resource generates them from `CARD_FILTER_SETS`.
- **Search rate limiting is two-tier** — a per-IP circuit breaker (1000/min, `middleware.ts`) + a global all-callers cap on `/api/printings/search` (5000/min, `SEARCH_GLOBAL_RATE_LIMIT_PER_MIN`) that bounds aggregate Postgres-pool load. Both are in-memory, which is genuinely global only because the app runs a single `nextjs` container — scaling to N containers makes each limit per-instance (×N); wire `lib/rate-limit.ts` to Redis first.
- **Trade-interest pings** (binder + wants copy actions) — both post via `DISCORD_WEBHOOK_TRADE_INTEREST` with a 15-min in-memory dedupe (per-container, same caveat as rate limiting). `lib/discord/links.ts` hardcodes the channel the webhook posts to — update it if the webhook ever moves channels.
- **MCP-proxied write endpoints must pass `allowOAuth`** — MCP tools (`add_to_wants`, `remove_cards_from_deck`, `get_results`, …) call internal `/api/*` routes with the caller's bearer. Volzar (the hosted chat) mints an OAuth 2.1 **JWT**; Claude Desktop uses an `mcp_` token (a *different*, non-`allowOAuth` validation path). So a route that omits `authenticateRequest(req, body, { allowOAuth: true })` 401s Volzar + OAuth clients while still working in Claude. Any route an MCP tool hits needs the flag (hit on `/api/wants/add`, `/api/wants/remove`, `/api/binders/[id]/cards/[cardId]`).
- **Volzar access** (`/volzar`, hosted AI chat; renamed from Fabby Chat, old URL redirects) — standard for EVERY signed-in user since 2026-07: `canUseVolzar` (`lib/ai/volzar-access.ts`) is now just "flags object present" (signed-in), so pass `null` when signed out — an always-constructed `{...roles}` object opens the gate for anonymous visitors (the /opt link hit this). Cost control lives in `lib/ai/tiers.ts`: 50 msgs/user/day + a site-wide 2,000/day backstop (`VOLZAR_GLOBAL_DAILY_LIMIT` env override) + 30 req/hr burst, all enforced in `/api/volzar`; superadmins exempt from the daily caps. Everyone runs the pinned cheapest model (`resolveChatModel`); only superadmins pick models. The old supporter/grant cohort (`users.metafy_supporter_tier='paid'` / `users.volzar_access`) still exists but now only drives the post-login `/volzar` routing preference (`app/auth/post-login`) — its rule is inlined there, deliberately NOT via canUseVolzar. Tier still lazily re-verified on chat open (`METAFY_TIER_TTL_MS`; `lib/metafy/sync-tier.ts`) for other supporter surfaces.
- **Two shorthand parsers, edit BOTH** — `lib/fab-shorthand-parser.ts` (MCP) and `lib/search/fab-shorthand-parser.ts` (/opt) drift; shared tests in `lib/fab-shorthand-parser.test.ts` pin them. A pattern's parser may `return false` to DECLINE a match (token stays in the text for the name search) — without it the token is blanked even when unapplied (the "red alert boots" → "alert boots" bug).
- **`search_printings` is language-aware** — `options.language` ('fr'/'de'/'it'/'es'/'ja') swaps results to that language's printing when one exists (join: `card_unique_id` + `printings.language`, closest foiling/edition/set) + `name_local` from `card_translations`; the English printing is the guaranteed fallback. Name queries are English-only, BUT a zero-result name falls back to translated-name lookup (`getCardIdsByTranslatedName`), so native-language names resolve. Volzar chat UI notes live in `app/volzar/CLAUDE.md`.
- **`/api/search/core` POST body is `{ filters, options }`** — `limit`/`sortBy`/`sortOrder` must go under `options`; at the top level they're silently ignored (defaults to limit 50). The legacy `PrintingSelector` passes them top-level.

## API Route Pattern

Use service layer + multi-auth for all routes. Return `{ success: true, data }` or `{ error: "message" }`.

```typescript
import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { binderService } from "@/lib/services"

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {})
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const result = await binderService.getBinder(binderId, authResult.userId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data })
}
```

## Authentication

Four methods: NextAuth Session, Discord Bot Token, MCP Token, OAuth 2.1 Bearer. See `lib/auth/CLAUDE.md` for details.

```typescript
import { authenticateRequest, authenticateSession } from "@/lib/auth/multi-auth"
```

## Testing

### Running tests

```bash
npm run test                          # all tests (watch mode)
npx vitest run                        # all tests (CI / one-shot)
npx vitest run <path>                 # single file
```

Requires `POSTGRES_URL` in `.env.local` for service integration tests (reads via `vitest.setup.ts` → `loadEnvConfig`).

**Tests run only if their path matches a `vitest.config.ts` project `include` glob** (`components/**`, `app/admin/**`, `app/api/**`, `lib/**`, `app/volzar/**`, …). Tests under a new top-level `app/` dir are silently skipped until you add its glob (hit when the chat moved `app/admin/fabby-chat` → `app/fabby-chat`, now `app/volzar`).

### Two-layer pattern

Every feature gets two test files:

| Layer | File location | DB | What it proves |
|-------|---------------|----|----------------|
| **Service integration** | `lib/services/postgres/**/*.test.ts` | Real (local Docker) | Business logic, transactions, edge cases |
| **Route unit** | `app/api/**/*.test.ts` | None (mocked service) | Auth, validation, grouping, HTTP response shape |

### UI components & flows → prefer Playwright e2e

For React components and multi-step UI flows (admin forms, dialogs, pages), reach for the **`/e2e-test` skill** (Playwright) — **whenever possible** — instead of a jsdom/vitest component test. e2e runs the real Next dev server: automatic JSX runtime, real APIs, real routing.

- **Never add `import React` to a component just to make a vitest/jsdom component test render.** Next uses the automatic JSX runtime, so components don't need `React` in scope. If a jsdom component test throws `React is not defined`, that's a test-harness JSX-transform quirk — **switch to an e2e test**, don't mutate production code to satisfy the runner.
- e2e specs live in `e2e/` (gitignored), conventions in the `e2e-test` skill. Superadmin-only pages work with `storageState: 'e2e/auth.json'` (seeded user is a superadmin).

### Service integration test conventions

- `beforeAll`: query a real FK value (e.g. `printingId`) needed to insert test rows
- `beforeEach`: insert isolated test data using `crypto.randomUUID()` IDs
- `afterEach`: `db.delete(users).where(eq(users.id, testUserId))` — cascade handles binders → inventory items
- Import service directly: `import { PostgresBinderService } from './PostgresBinderService'`
- Do **not** import from `@/lib/services` in service test files (circular dep risk — see Known Gotchas)

### Route unit test conventions

```typescript
vi.mock('@/lib/services', () => ({ binderService: { methodName: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
// Import AFTER mocks (vi.mock is hoisted; referencing outer variables in factories breaks)
import { POST } from './route';
import { binderService } from '@/lib/services';
const mockMethod = vi.mocked(binderService.methodName);
```

See `app/api/collection/transfer/route.test.ts` for a complete example.

## Environment

See `.env.example` for required environment variables.
