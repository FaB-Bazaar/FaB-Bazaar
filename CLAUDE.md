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

- **Verify, don't assume — if it can be checked, check it** — before stating anything factual about this codebase, its data, or a dependency's behavior, confirm it: read the file, query the DB, probe the URL, run the command. Confident recall is the failure mode, and it is indistinguishable from knowledge until checked (`@next/env` override semantics, the CardVault field that holds a print's language, whether a non-NULL `image_url` actually resolves — each looked obvious and each needed a check). A present value is not a working value: `image_url IS NOT NULL` says nothing about whether the image exists, and a row existing says nothing about whether the app reads it. When verification genuinely isn't possible, say so and label the claim an assumption rather than asserting it flat. When the user questions a claim, re-verify it — don't restate it.
- **Test-first for new features and bugfixes** — invoke the `/tdd` skill before writing implementation code. Watch the test fail (RED), write minimal code to pass (GREEN), then manual-test against the real runtime (dev server + curl for APIs, Playwright for UI). Tests-after produces suites that pass on first run and prove nothing about regressions. If you skipped TDD, say so explicitly and run a manual walkthrough before marking the work done.
- **Do not push to remote without an explicit request** — local commits at clean checkpoints are fine. `git push` (and force-pushes / PR creation / deploys) wait for the user to say "push", "deploy", or equivalent. Approval for one push does NOT carry over to the next.
- **PostgreSQL only** — MongoDB fully removed (2026-03-08). No Mongoose models, no MongoDB connections. The `models/` directory is dead code.
- **Don't modify auth middleware** — authentication is working and locked down
- **File locking** — many core files are locked and cannot be modified
- **Service layer for all DB access** — never query the database directly; use services from `@/lib/services`
- **Use `@/lib/fab-constants`** for card metadata (SET_MAP, FOILING_MAP, RARITY_MAP) — do NOT use metadataService
- **Use `@/lib/utils/display-username`** for rendered usernames — `displayUsername()` strips internal `dc_`/`gh_` prefixes (OAuth-provisional usernames; the prefix marks "never chose a name" and prevents collisions), `profileHref()` URL-encodes profile links. Discord bot commands still need raw usernames. MCP tools: stripped names in message text, raw `username` + `display_username` in structured data (see who_has).
- **`tcg_low` is THE price** — every displayed price, valuation total and "cheapest" comparison uses `tcg_low` (`tcgLow`). Never render `tcg_market` as an unlabeled price, and never sum it into a total. The two diverge hard (median low/market is 0.42 under $1, 0.99 above $100; low can also exceed market on a spiking card), so mixing fields across surfaces makes the same card look ~2× different depending on the page — the bug this rule exists to prevent. `tcg_market` is legitimate ONLY when the UI names it: the binder low/market/mid/high breakdown, `tcg-market-*` sort options, an export column, or an explicit `Market:` label. As a fallback write `tcg_low ?? tcg_market`, never the reverse. Applies to service aggregates too — deck `estimatedValue` and binder `totalValue` sum `tcgLow`.

## Deprecated/Removed Services

- `metadataService` — use `@/lib/fab-constants` instead
- `heroService` — removed; use `printingsService` + `@/lib/fab-constants/heroes` + `articleService`
- `binderStatsService` — removed; use `binderService.getUserBindersWithStats()`
- `denormalizationService` removed (MongoDB-only); `tradeMatchingService`, `tradeAnalysisService`, `matchingService` deprecated — their `lib/trade-analysis` tests are known-red, don't chase them

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
- **Volzar access** (`/volzar`, hosted AI chat; renamed from Fabby Chat, old URL redirects) — standard for EVERY signed-in user since 2026-07: `canUseVolzar` (`lib/ai/volzar-access.ts`) is now just "flags object present" (signed-in), so pass `null` when signed out — an always-constructed `{...roles}` object opens the gate for anonymous visitors (the /opt link hit this). The logged-in home is the user's `users.landing_page` preference, **default `/daily`** (2026-08-21, was `/opt`; `DEFAULT_LANDING_PAGE` in `lib/landing-page.ts` — a default flip never touches explicitly saved preferences, only NULL/unknown): `/` (app/page.tsx) and post-login both redirect signed-in users through `resolveLandingPath`; the marketing homepage is signed-out-only, and login callbackUrls (binder → sign-in → binder) take precedence over the landing preference. Cost control lives in `lib/ai/tiers.ts`: 50 msgs/user/day (boosted to 200 by a manual `users.volzar_access` grant — the `/admin/user-access` toggle, and the "contact mistercakes" escalation the 429 message names; supporters deliberately get NO quota boost) + a site-wide 2,000/day backstop (`VOLZAR_GLOBAL_DAILY_LIMIT` env override) + 30 req/hr burst, all enforced in `/api/volzar`; superadmins exempt from the daily caps. Model choice is role-based (`resolveChatModel` + `DEFAULT_CHAT_MODEL`/`SUPERADMIN_CHAT_MODEL` in `lib/ai/tiers.ts`, the ONE place both the route and `app/volzar/page.tsx` `models[0]` read from): everyone is pinned to the cheapest paid model; superadmins default to the free stealth bake-off model (`stealth/ox-alpha`, 2026-08 — ~3× the prompt tokens per turn, so don't promote it site-wide without re-checking its price) and may name any other allowlisted `model`; an absent `model` means "my role's default". The in-UI model picker was removed (2026-07) — switching models is a backend change. Metafy tier still lazily re-verified on chat open (`METAFY_TIER_TTL_MS`; `lib/metafy/sync-tier.ts`) for other supporter surfaces.
- **Web-component dark mode: `:host([dark])`, never `:host-context(.dark)`** — Firefox never implemented `:host-context()` (dropped from the spec), so it silently ships light-on-dark there. Components call `watchTheme(this)`/`unwatchTheme(this)` (`web-components/src/utils/theme.ts`), which mirrors the page's `.dark` class onto a host `dark` attribute. Cross-engine checks: tag a Playwright test `@firefox` (opt-in `firefox-desktop` project). After editing `web-components/src`, rebuild AND copy: `cd web-components && npm run build && cp dist/fabbazaar-ui.js ../public/wc/`.
- **`fab-buylist-block` heading/prerolled/list-id** — the block heading attr is `heading`; a legacy `title` attr still works but is captured then STRIPPED off the host (`title` is a global HTML attribute → browser tooltip over the whole block; `fab-section-header` still has this bug). Article pages pre-roll the priced rollup server-side (`prerollBuylist` → `lib/buylist/pricing.ts`, reader-agnostic because pages are ISR-cached) and pass it as `prerolled`; the client fetch is only an ownership enhancement. `lib/buylist/pricing.ts` touches the service layer — never import it from the web-component bundle (rollup.ts is the pure/shared half). `list-id` keys localStorage check-off state.
- **`web-components/src/**/*.test.ts` runs under the vitest node project** — pure component-side utils (e.g. `buylist-export.ts`) are testable; Lit element behavior still needs Playwright.
- **Two shorthand parsers, edit BOTH** — `lib/fab-shorthand-parser.ts` (MCP) and `lib/search/fab-shorthand-parser.ts` (/opt) drift; shared tests in `lib/fab-shorthand-parser.test.ts` pin them. A pattern's parser may `return false` to DECLINE a match (token stays in the text for the name search) — without it the token is blanked even when unapplied (the "red alert boots" → "alert boots" bug). `c:`/`tal:`/`hero:` accept aliases + unambiguous prefixes (`c:mech`, `tal:dra`, `hero:dor`) via `resolveClassShorthand` (`lib/fab-constants/classes.ts`), `TalentUtils.resolveTalent`, `resolveHeroShorthand` (`lib/fab-constants/heroes.ts`); every two-letter class prefix resolves (`me`→mechanologist is the one curated tie-break; merchant is `mer`); ambiguous/unknown input stays raw on purpose — add curated aliases to `CLASS_ALIASES` / `TALENT_ABBREVIATIONS` / `HERO_NICKNAMES`, don't loosen the uniqueness rule.
- **`search_printings` is language-aware** — `options.language` ('fr'/'de'/'it'/'es'/'ja') swaps results to that language's printing when one exists (join: `card_unique_id` + `printings.language`, closest foiling/edition/set) + `name_local` from `card_translations`; the English printing is the guaranteed fallback. Name queries are English-only, BUT a zero-result name falls back to translated-name lookup (`getCardIdsByTranslatedName`), so native-language names resolve. Volzar chat UI notes live in `app/volzar/CLAUDE.md`.
- **`/api/search/core` POST body is `{ filters, options }`** — `limit`/`sortBy`/`sortOrder` must go under `options`; at the top level they're silently ignored (defaults to limit 50). The legacy `PrintingSelector` passes them top-level.
- **Collectible (playmat) images live in Cloudflare Images** with deterministic ids `playmat-<name-slug>-<year>` — duplicate-id uploads are rejected, so mirroring is idempotent. Bulk catalog load: `scripts/ingest-playmats-csv.ts` (dry-run default; target prod with `COLLECTIBLES_BASE_URL` + `COLLECTIBLES_BEARER`). Image-map snapshots: `~/Documents/FaB-Bazaar-Notes/playmats/`.
- **Cloudflare Images API needs multipart/form-data even for URL-based ingest** (urlencoded body → error 5415); URL-ingest from imagedelivery.net itself is refused (5454) — copy via download+re-upload. Fresh custom-id images can take minutes to propagate (API GET flaps found/not-found); the `/images/v2` listing paginates unstably past 10k — verify per-id, never by listing. Prod's WAF 403s python-urllib's default User-Agent — set a UA in scripts that hit fabbazaar.app.
- **Card image ids derive from printing characteristics (2026-07)** — `image_url` ids are computed from the row itself (language/collector/foiling/art/edition/face → LSS print-code style, e.g. `JA_ROS076-RF`; `lib/images/deterministic-image-id.ts`). The OLD printing_id-keyed Cloudflare images were DELETED — constructing `<CF_BASE>/<printing_id>/public` 404s; always read `image_url` / `getCardImageUrl()`. `import-new-set.ts --upload-images` now mints deterministic ids on the FIRST upload (`lib/images/ingest-image-ids.ts`) — no `migrate-image-ids.ts` pass needed after it. Other importers still mint printing_id-keyed images: run `scripts/migrate-image-ids.ts --live` after those (idempotent; ~600 alt-art collision rows keep printing_id images by design and survived deletion). The CF account is SHARED with other apps — image deletion is allowlist-from-printings only (`scripts/delete-orphan-images.ts`), never inventory-diff.
- **CardVault backend API** — `api.cardvault.fabtcg.com/carddb/api/v1/`: `advanced-search/?q=` or `?set_code=X&page_size=250` (trailing slash required; large page sizes honored) and `card_id/<slug>/`. `capture-cardvault.ts` is a pure API client (v2) — a collector search returns ALL cards sharing the number (DFC promos like HER146). Import invariants: lib/import/CLAUDE.md.
- **/opt set filter holds `grp:` group tokens, not just set codes** — `selectedSets` (OptUiState) mixes plain codes with deck-product group tokens (`grp:blitz` etc.; `SET_FILTER_GROUPS` in `lib/fab-constants/sets.ts`, membership DERIVED from SET_METADATA name prefixes / `category='armory'`, so regenerating constants updates groups). Expand via `expandSetSelections` at the server boundary (`buildServerFilters` does); any new consumer of raw `selectedSets` must filter/expand tokens first (the /opt packs fetch does). `getSetImageOrFallback` returns `''` for most promo/product sets — `SetGridButton` renders text-only tiles, don't reintroduce `<img src="">`.
- **Representative-printing lookups must prefer English** — `DISTINCT ON` picks ordered only by set/edition started surfacing JA/FR card faces after the i18n backfill. Order by `(image_url IS NOT NULL) DESC, (language='en') DESC, set, edition` (see `/api/cards/by-talishar-id` + gameResults `resolveImageUrls`); integration-test fixtures must mirror the same ORDER BY or they drift.
- **Dual-source ID model (migration 0088)** — `printing_id`/`card_unique_id` are OUR immutable PKs (user FKs + Cloudflare image ids); `fab_cube_*` anchors link to the fab-cube feed (NULL = provisional, pipeline never prunes), `lss_print_id` = CardVault print UUID (ingest idempotency). NEVER match cross-source rows on `art_variations` or rarity — fab-cube's encoding is editorially unpredictable; the adoption key is `(set, collector_number, edition, foiling, language)`, and even that is legitimately 1:N (double-sided prints = two unlinked rows per face; art variants differ only by image filename).
- **Spoiler-season set ingest** — `scripts/import-new-set.ts --set=X` (dry-run default; idempotent via `lss_print_id`; `--cache-dir` is REQUIRED on non-Mac hosts — the default is a macOS path; `--upload-images` only covers rows created in that same run). The set must exist in the `sets` table first.
- **Binder-content invariant** — around any migration/merge/pipeline change touching printings, run `scripts/snapshot-binder-values.ts --out=…` then `--compare=…`: the checksum covers every inventory row's quantity + prices and must be identical.
- **Bad upstream feed data → feed_overrides, never DB edits** — when the fab-cube feed ships a wrong `tcgplayer_product_id`/url (SEA015-017 priced off the 1st Strike products this way), record a row in `feed_overrides` (`/admin/feed-overrides`, superadmin). Pipeline step 02 patches the feed before pricing, so the correction survives every nightly run; direct `printings` edits are clobbered by 005 (runs NIGHTLY despite the "weekly" name) and never reprice. Overrides carry an `art_variations` discriminator (migration 0096; NULL = any, `[]` = no-variant only, `['AA']` = exact) because the feed is 1:N on (collector, edition, foiling) — the ELE146 alt-art repoint would otherwise have swapped the regular printing's price too. The printing TCGplayer PATCH route auto-records an exact-keyed override, so a manual admin fix IS durable. See pipeline/CLAUDE.md.
- **`cards` classification columns are pipeline-owned too — fix the transformer, not the DB** — 005 upserts `classes`/`talents`/`is_*`/`has_*` from `003_cards_to_printings_transformer.py` every night, so a one-shot data migration on them is silently reverted the next night. Migration 0065 (pirate: talent → class) hit exactly this: it "applied" but the /opt Class → Pirate filter matched 0 cards on prod for two months. Pirate is a CLASS (official LSS; `CLASSES` in 003, `has_pirate` kept as its flag since there's no `is_pirate` column); migration 0104 re-applies the move in the transformer's exact shape (`{generic}`→`{pirate}`, dual-class `{necromancer,pirate}`) so the nightly is a no-op. Reclassifying anything: change 003 first, then write the migration to match its output (`test_pirate_class.py` + `PostgresPrintingsService.pirateClass.test.ts` show the pattern).
- **Deck zones: the sideboard IS `inventory`; `benched` is a maybe-pile** — the `deck_category` enum is `hero/equipment/maindeck/inventory/benched/tokens` (`sideboard` was dropped in migration 0011). In FaB the sideboard = inventory (Talishar import + matchup pool); `benched` is cards under consideration that are NOT part of the playable deck (never exported, never in a matchup pool). `normalizeDeckCategory` (`lib/deck/deck-category.ts`) is the one alias map (`sideboard`→`inventory`, `bench`→`benched`, …) — the add/remove routes and the MCP add/remove tools all run through it; don't hand-map zone strings elsewhere. Matchup plans (`decks.metadata.matchups[]`) are Talishar-id `in[]/out[]` deltas against the base deck; `save_deck_matchup` `lineup` mode (`lib/deck/matchup-lineup.ts`) derives them from a full active list using the SAME pool model as `MatchupSideboardEditor` (hero+equipment+maindeck = base, inventory = bench, hero never sided). NB the matchup PUT route `sanitizeMatchup`s BEFORE validating — unknown ids are silently dropped, not rejected — so validate against the pool yourself (lineup mode does).
- **Talishar `playerHero`/`opposingHero` are END-of-game snapshots — never key a hero rollup on the raw column** — heroes that transform mid-game (Teklovossen → the Mechropotent, Arakni Marionette/Web of Deceit → a random demi-hero like Redback/Orb-Weaver, Levia → Blasmophet) are reported as the transformed form, so a Gherkin game listed the opponent as "Arakni, Redback" (a demi-hero nobody starts as) and one hero's games split across matchup buckets. `game_results` keeps whatever Talishar sent (older rows have no archived payload to recover from); every service read path + `getDeckPerformanceForUser` bucketing maps through `canonicalHeroId(heroId, format)` (`lib/talishar/canonicalHero.ts` — adult vs young base picked by the Talishar numeric format code, verified from Talishar's `PlayerSettings.php`: 0/1 cc, 2 blitz, 14–16 silver age, 17 open). The sync additionally prefers the payload's `character[0]` (`resolveStartingHero`) for new rows. A new consumer of `player_hero`/`opponent_hero` or a raw blob's hero must go through `canonicalHeroId`.
- **fab-cube double-faced BACK printings self-link — never trust `other_face_printing_id` on a back row from the feed** — every back face in the feed carries `other_face_unique_id` = its own id (107/107, 2026-09) while fronts link correctly, so 322 back rows pointed at themselves and the search flip rendered Nitro Mechanoid as its own other face. 003 now builds a reverse index (`index_face_links`: front → the back it points at) and resolves a back's missing/self link through it, emitting NULL when no front claims it, and pairs UNFLAGGED transform prints (Bank Breaker: AMX022 ships `is_DFC: false`, JDG052 no DFC info at all — CardVault models both as one two-face card) by natural key + the `*_BACK.webp` image; migrations 0105/0106 brought the DB to that shape (pipeline-owned column, so the transformer had to change first — same lesson as pirate/0104). `enrichOtherFaces` also reverse-resolves at read time, and `PostgresIngestService` dedupes back faces by natural key + face side (fab-cube backs have no `lss_print_id`). Tests: `pipeline/scripts/test_dfc_back_link.py`, `PostgresPrintingsService.otherFace.test.ts`.
- **Curated-list add path doesn't validate printing_id** — a raw collector number was stored once (SEA255, repaired in migration 0090); the validation gap is still open.
- **Slug/name uniquifiers must be bounded — a sync `while (taken)` loop hangs the whole server** — binder slugs cap at 20 chars; `generateUniqueBinderSlug` used to append `-N` then re-truncate, so a taken 20-char base (`csv-import-YYYY-MM-DD` is 21 → every CSV import) re-produced the same taken slug forever. Node's event loop pinned at 100% CPU for 3.7h on 2026-08-26 (second Fabrary import of the day); Docker marked it unhealthy but `restart: unless-stopped` only acts on exit, and Caddy only logged 502s. Now trims the base to fit the suffix and throws after a hard cap (`lib/utils.generateUniqueBinderSlug.test.ts` pins the repro). Any new retry/uniquify loop needs an upper bound; prefer the DB-backed `generateUniqueSlug` pattern in `PostgresDeckService` (awaits, so it yields) or a counter cap. Related: prod's root FS is read-only, so `isrFlushToDisk: false` keeps ISR revalidation in memory (else EROFS spam), and Caddy writes an access log to `/data/access.log` in the `caddy_data` volume.
- **Never `npm run build` while the dev server is running** — both write `.next`; the prod build clobbers the dev artifacts and the dev server starts failing with `Cannot find module './vendor-chunks/…'` on fresh page compiles. Kill the dev server first; recovery = restart it (rebuilds `.next`).

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

**Tests run only if their path matches a `vitest.config.ts` project `include` glob** (`components/**`, `app/admin/**`, `app/api/**`, `lib/**`, `app/volzar/**`, …). Tests under a new top-level `app/` dir are silently skipped until you add its glob (hit when the chat moved `app/admin/fabby-chat` → `app/fabby-chat`, now `app/volzar`). `hooks/**` has NO glob at all — pure logic that needs node tests must live in `lib/` (why `resolveHeroFilter` moved to `lib/deck/`).

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
- **Facet tests: one fixture card per FILE** — files run in parallel against one DB, and two files reprojecting the same card's `facet_tags` is a lost-update race. Taken cards are listed in each facet test file's header comment. Scope cleanup to your own slugs (never `LIKE 'zzz-%'`); dynamic card pickers must ORDER BY from opposite ends (ASC vs DESC) so they can't collide.
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
