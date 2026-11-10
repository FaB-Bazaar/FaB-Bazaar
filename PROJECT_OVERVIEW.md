# FaB Bazaar — Project Overview

FaB Bazaar is a web platform for players and collectors of the Flesh and Blood
trading card game: track a collection in binders, keep a wants list, build and
analyze decks, follow card prices, and find people to trade with.

This page is the map. For setup, see [`CONTRIBUTING.md`](./CONTRIBUTING.md); for
the conventions and gotchas you need before changing code, see
[`CLAUDE.md`](./CLAUDE.md) (and the `CLAUDE.md` files inside individual
directories).

## Tech stack

| Part | What we use |
|---|---|
| Web app | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS with shadcn/ui (Radix) components |
| Database | PostgreSQL, accessed through Drizzle ORM |
| Cache | Redis (optional locally — every use falls back to the database or to memory) |
| Sign-in | NextAuth (Discord), plus bot, MCP and OAuth 2.1 tokens for API clients |
| Card images | Cloudflare Images |
| Price and card data | A nightly Python pipeline (DuckDB for analytics) |
| Embeddable widgets | Lit web components (`web-components/`) |
| Tests | Vitest (unit and database integration), Playwright (end to end) |
| Hosting | Docker Compose on a single server, behind Caddy |

There is no MongoDB. It was removed in March 2026; a few data shapes from that
era remain on purpose (24-character ids on older users and articles, `_id` in
some responses).

## What the app does

- **Collection** — binders of cards with quantities, trade flags and values;
  a wants list; a card scanner that reads card names from a photo in the browser.
- **Decks** — a deck builder with legality checks, statistics, matchup plans,
  price breakdowns, Talishar import/export and game results.
- **Card search** — filterable search across every printing (`/opt`), with a
  shorthand query syntax and curated "facet" tags.
- **Prices** — daily price updates, movers, and value totals. `tcg_low` is the
  price shown everywhere unless a view names another one.
- **Community** — public profiles, "who has / who wants" trade matching, stores
  and events, articles and guides, curated starter kits, reference "Decks to Beat".
- **Integrations** — a Discord bot, an MCP server for AI assistants, and a
  hosted AI chat (Volzar).

## Repository layout

```
app/              Next.js routes: pages and API handlers (app/api)
components/       React components (components/ui = shared base components)
hooks/            React hooks
contexts/         React contexts (auth, cookie consent, dark mode)
lib/              Business logic
  services/       The service layer — the ONLY place that talks to the database
  postgres/       Schema (Drizzle) and hand-written SQL migrations
  client/         Typed browser-side wrappers around the API
  fab-constants/  Card metadata: sets, rarities, foilings, heroes, classes
  deck/, search/, pricing/, scan/, …   Pure logic per feature, mostly unit-tested
pipeline/         Nightly Python pipeline (card data, prices, images)
web-components/   Lit components bundled to public/wc/ for embeds and articles
scripts/          One-off and maintenance scripts
seeds/            Card data used to seed a fresh local database
e2e/              Playwright specs
public/           Static assets
```

## How the pieces fit

```
Browser ──> Next.js pages ──> lib/client ──> app/api routes ──> lib/services ──> PostgreSQL
                                                   │
Discord bot, MCP clients, OAuth apps ──────────────┘

Nightly: card feed + price sources ──> pipeline/ (Python, DuckDB) ──> PostgreSQL
```

- **Pages never query the database.** They call API routes, usually through the
  typed wrappers in `lib/client`.
- **API routes authenticate, validate and delegate.** Every route goes through
  the shared multi-auth helper and then calls a service from `@/lib/services`.
  Responses are `{ success: true, data }` or `{ error }`.
- **Services own the SQL.** Each one has a contract in `lib/services/contracts`
  and a PostgreSQL implementation in `lib/services/postgres`.
- **The pipeline owns card and price data.** It rebuilds printings and prices
  every night, so fixes to that data belong in the pipeline (or in the
  override tables it reads), not in one-off database edits.
- **Analytics stay out of the app.** The pipeline computes signals in DuckDB and
  writes small result tables back to PostgreSQL; the app only reads those.

## Working on it

- **Run it locally:** `bash dev-setup.sh`, then `npm run dev`
  ([`CONTRIBUTING.md`](./CONTRIBUTING.md), [`DOCKER.md`](./DOCKER.md)).
- **Tests:** `npx vitest run` for unit and integration tests (integration tests
  need the local database); Playwright specs live in `e2e/`.
- **Database changes:** write a numbered SQL file in `lib/postgres/migrations/`
  by hand. Do not run the Drizzle generator — `CLAUDE.md` explains why.
- **Secrets:** only through environment variables. `.env.example` lists them;
  never commit real values.

## Licensing

Source code is licensed under the GNU AGPL v3 ([`LICENSE`](./LICENSE)).
Community-contributed card data has its own terms in
[`DATA-LICENSE.md`](./DATA-LICENSE.md).
