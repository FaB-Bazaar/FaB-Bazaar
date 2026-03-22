# PostgreSQL Schema Reference

Fully normalized PostgreSQL schema with Drizzle ORM. All related data fetched via JOINs (2-5ms on 40k+ rows). All PKs are text nanoids, not auto-increment integers.

- **Schema**: `lib/postgres/schema.ts` (source of truth for all columns/indexes)
- **Config**: `drizzle.config.ts`
- **Connection**: `lib/postgres/db.ts` (node-postgres pool, max 20 clients)
- **Migrations**: `lib/postgres/migrations/` (0000-0023)

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
| `cards` | Card-level data (one per logical card). 40+ boolean type/class flags, 13 talent flags, format legality | — |
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
```

All user-owned tables cascade-delete when the user is deleted.

## Key Design Notes

- Card stats (pitch, power, etc.) live on `cards`, not `deck_cards` — JOIN through `printings`
- `inventory_items` uniqueness: `(binderId, printingId, condition, language)`
- `decks.metadata` (JSONB) stores matchup sideboard configs
- `printings` has denormalized price category booleans (`isBudget`, `isUnder5`, etc.) for fast filtering
- Emails are AES-encrypted; `emailHash` column used for lookups
