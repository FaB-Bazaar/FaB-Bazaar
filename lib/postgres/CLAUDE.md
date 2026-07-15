# PostgreSQL Schema Reference

Fully normalized PostgreSQL schema with Drizzle ORM. All related data fetched via JOINs (2-5ms on 40k+ rows). All PKs are text nanoids, not auto-increment integers.

- **Schema**: `lib/postgres/schema.ts` (source of truth for all columns/indexes)
- **Config**: `drizzle.config.ts`
- **Connection**: `lib/postgres/db.ts` (node-postgres pool, max 20 clients)
- **Migrations**: `lib/postgres/migrations/` (0000 through the current latest — check `ls lib/postgres/migrations/ | sort | tail` to find the next number). Auto-apply on deploy via `scripts/run-migrations.sh` (idempotent; tracks applied names in `_applied_migrations`). Apply locally with `docker exec -i fabbazaar-postgres psql -U fabbazaar -d fabbazaar < <file>` — `psql` is not on the host PATH.

## Enums

| Enum | Values |
|------|--------|
| `visibility_level` | `public`, `private`, `friends`, `unlisted` |
| `condition` | `NM`, `LP`, `MP`, `HP`, `DMG` |
| `priority` | `low`, `medium`, `high`, `urgent` |
| `deck_category` | `hero`, `equipment`, `maindeck`, `sideboard`, `inventory` |

## Tables

| Table | Purpose | Owner FK |
|-------|---------|----------|
| `users` | Accounts, auth, profiles, roles | — |
| `cards` | Card-level data (one per logical card). 40+ boolean type/class flags, 13 talent flags, format legality. **`essences text[]`** is hero-only — the essence card pools a hero grants access to (Terra → `{earth}`, Oldhim → `{earth,ice}`); empty `{}` for every non-hero card. Populated by pipeline 003 from the `"essence of X"` keyword. | — |
| `printings` | Physical printings (set + edition + foiling). Pricing, images, rarity/foiling flags | `cards.cardUniqueId` |
| `binders` | Named collections. Visibility, feature flags (allowWhoHas, allowInSearch, etc.) | `users.id` CASCADE |
| `inventory_items` | Card holdings per (binder, printing, condition, language). forTrade/forSale flags | `users.id` + `binders.id` CASCADE |
| `wants_items` | Want list entries. One per (user, printing) | `users.id` CASCADE |
| `decks` | Decks with `publicId` (nanoid for URLs), `metadata` (JSONB for matchups etc.) | `users.id` CASCADE |
| `deck_cards` | Join table: deck + printing + category + quantity | `decks.id` CASCADE |
| `articles` | CMS content. `contentType`: hero/article/guide/news/strategy/tournament. `sections` is JSONB | `users.id` CASCADE |
| `oauth_clients` | Registered OAuth 2.1 clients | `users.id` CASCADE (nullable) |
| `oauth_authorization_codes` | Short-lived auth codes with PKCE support | — |
| `oauth_access_tokens` | Bearer + refresh tokens | — |
| `site_settings` | Key-value store (key text PK, value JSONB) | — |
| `sets` | Set metadata reference data — SOURCE OF TRUTH for set names, release dates, `release_order` (global chronological, spaced by 10), `display_order` (curated printing-carousel ranking used by `sortPrintings`; migration 0062), category/tier, `is_core`. Seeded by migration 0061. `lib/fab-constants/sets-data.generated.ts` is a generated snapshot — never edit it by hand; run `scripts/generate-set-constants.ts` after changing rows (sync pinned by `lib/fab-constants/sets-sync.test.ts`) | — |
| `daily_movers` | Daily price-signal sink (gainers, decliners, breakouts, steady risers). 1-year retention. PK `(as_of_date, signal_type, printing_id)` | `printings.printingId` (logical) |
| `card_facet_tag_votes` | Community facet votes, 1 per (card, tag, user). ≥2 distinct voters projects into `cards.facet_tags`. Migration 0080 | `cards`, `users` CASCADE |
| `facet_tag_suggestions` | New-facet-term review queue (curator approve mints a `facet_tag_definitions` row) | `users` |
| `facet_tag_audit` | Append-only facet add/remove log. **NO FKs by design** — survives user/card deletion (accountability) | — |
| `collectibles` | Global admin-curated non-card catalog (playmats first; `kind` enum is extensible). NOT binder inventory — deliberately no printing/condition/pricing. Unique `(kind, name, year)`. Migration 0085 | `users.id` SET NULL (`created_by`) |
| `user_collectible_marks` | One have/want mark per (user, collectible) — `status` enum, upserted. Powers /playmats toggles + counts | `users.id`, `collectibles.id` CASCADE |

## Relationship Map

```
users
 ├── binders
 │    └── inventory_items → printings → cards
 ├── wants_items → printings → cards
 ├── decks
 │    └── deck_cards → printings → cards
 ├── articles
 └── oauth_clients
      └── oauth_authorization_codes, oauth_access_tokens

cards ──< printings (one card, many printings)

daily_movers ──> printings (one row per (date, signal, printing); populated by pipeline)
```

All user-owned tables cascade-delete when the user is deleted.

## Key Design Notes

- Card stats (pitch, power, etc.) live on `cards`, not `deck_cards` — JOIN through `printings`
- `inventory_items` uniqueness: `(binderId, printingId, condition, language)`
- `decks.metadata` (JSONB) stores matchup sideboard configs
- `printings` has denormalized price category booleans (`isBudget`, `isUnder5`, etc.) for fast filtering
- Emails are AES-encrypted; `emailHash` column used for lookups
- `daily_movers` is populated by the pipeline (DuckDB → Postgres reverse-ETL), never from app code. Not in `schema.ts` yet — add a Drizzle definition before any service-layer access.
- Drizzle `timestamp` columns are **date-mode** (expect a JS `Date`). JSON route bodies deliver ISO **strings** — coerce with `new Date(...)` at the API route before passing to a service, or the insert throws (hit on `events.startDate/endDate`).
- Strict name search is **accent-insensitive** (migration 0066): `immutable_unaccent(name) ILIKE immutable_unaccent(query)`, served by `cards_name_unaccent_trgm_idx` so it stays index-fast. `unaccent()` is only STABLE, so the `IMMUTABLE` wrapper (`unaccent('unaccent', $1)` — dictionary pinned) is required to build a functional index on it. Without the wrapper+index, wrapping the column in `unaccent` falls back to a seq scan.
