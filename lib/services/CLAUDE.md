# Service Layer Architecture

This directory contains the service layer that abstracts all database access behind clean interfaces.

## Directory Structure

- **`contracts/`** — TypeScript interfaces defining service APIs (database-agnostic)
- **`postgres/`** — PostgreSQL/Drizzle implementations (the only active implementations)
- **`index.ts`** — ServiceFactory singleton + all service exports

## Core Rules

- **All database access MUST go through services** — never query PostgreSQL directly
- **Use JOINs, not denormalization** — PostgreSQL handles JOINs in 2-5ms on 40k+ rows
- All service methods return `AsyncResult<T>`:

```typescript
type AsyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

## Active Services

Import from `@/lib/services`:

```typescript
import { userService, binderService, printingsService } from "@/lib/services"
```

| Service | Purpose |
|---------|---------|
| `userService` | User accounts, auth, profiles |
| `binderService` | Card collections/binders (includes `getUserBindersWithStats()` for stats + showcase cards) |
| `inventoryService` | Inventory items in binders |
| `wantsService` | User want lists |
| `printingsService` | Card search, printing lookup (use `isHero: true` filter for hero cards) |
| `deckService` | Deck management |
| `articleService` | Articles/CMS (includes hero guides via `contentType='hero'`) |
| `authService` | JWT/password utilities (database-agnostic) |
| `authTokenService` | Authentication tokens (MCP, Bearer, OAuth) |
| `oauthService` | OAuth client management |
| `oauthFlowService` | OAuth 2.1 protocol flows |
| `locationService` | User location data |
| `eventService` | Event management |
| `curatedListService` | Curated card lists |
| `gameResultsService` | Game result tracking |
| `siteSettingsService` | Site-wide key-value config. Generic `get<T>(key)` / `set(key, value)` |
| `setsService` | Set metadata reference data (`sets` table = source of truth: names, release dates/order, category/tier, core-set flag). After editing the table, regenerate the client snapshot: `npx tsx --env-file=.env.local scripts/generate-set-constants.ts` |

## Testing

Use `ServiceFactory.set*Service()` to inject mocks:

```typescript
import { ServiceFactory } from "@/lib/services"
ServiceFactory.setUserService(mockUserService)
```

## Card Facets (community + curator)

- **Two layers project into `cards.facet_tags`** (the index /opt, Volzar and MCP search): curator `card_facet_tags` (authoritative) ∪ community `card_facet_tag_votes` at ≥2 distinct voters (`COMMUNITY_VOTE_THRESHOLD`). Every write reprojects via the single `reproject()` in `PostgresFacetService`; "remove" = retracting your own vote. Migration 0080.
- **Personal truth** — `facetTags` searches with `facetTagsViewerId` also match the viewer's OWN sub-threshold votes. The viewer id is set SERVER-SIDE in `/api/printings/search` (any client-supplied value is stripped), and personalized searches BYPASS the Redis search cache — it invalidates on price changes only, so a personal entry is stale the moment the user votes.
- **`facet_tag_definitions.draft` is display-only** — it does NOT keep an assigned tag out of search. New-term proposals therefore live in the separate `facet_tag_suggestions` review queue (curator approval mints a definition) — never as draft defs.
- **Route split**: `/api/card-facets/*` = any signed-in user (vote/suggest; reads public), `/api/admin/card-facets/*` = curator/superadmin only. `facetTagsMode: 'all'` = `@>` contains; default ANY = `&&` overlap.

## Circular Dependency Warning

Never import from `@/lib/services` in any file that `index.ts` imports transitively (e.g. service implementations, `lib/metafy/tokens.ts`). It puts `ServiceFactory` in TDZ → `ReferenceError` at runtime. Use lazy `await import('@/lib/services')` inside async function bodies instead.

## Dead Contract Files (2 remaining)

These contract files still exist only because other files import their DTO types. The services themselves are removed.

| Contract file | Imported by | Use instead |
|--------------|-------------|-------------|
| `IMetadataService.ts` | `app/api/metadata/route.ts` (DTO types) | `@/lib/fab-constants` |
| `IBinderStatsService.ts` | `lib/stats/binderStats.ts` (DTO types) | `binderService.getUserBindersWithStats()` |

Once those DTO types are relocated, these files can be deleted.
