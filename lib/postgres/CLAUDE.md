# PostgreSQL Schema Reference

Fully normalized PostgreSQL schema with Drizzle ORM. All related data fetched via JOINs (2-5ms on 40k+ rows). All PKs are text nanoids, not auto-increment integers.

- **Schema**: `lib/postgres/schema.ts` (source of truth for all columns/indexes)
- **Config**: `drizzle.config.ts`
- **Connection**: `lib/postgres/db.ts` (node-postgres pool, max 20 clients)
- **Migrations**: `lib/postgres/migrations/` (0000 through the current latest — check `ls lib/postgres/migrations/ | sort | tail` to find the next number)

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
| `daily_movers` | Daily price-signal sink (gainers, decliners, breakouts, steady risers). 1-year retention. PK `(as_of_date, signal_type, printing_id)` | `printings.printingId` (logical) |

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
