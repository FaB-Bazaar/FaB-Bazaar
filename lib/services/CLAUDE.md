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
| `siteSettingsService` | Site-wide key-value config (e.g., `ads_enabled`). Generic `get<T>(key)` / `set(key, value)` |

## Testing

Use `ServiceFactory.set*Service()` to inject mocks:

```typescript
import { ServiceFactory } from "@/lib/services"
ServiceFactory.setUserService(mockUserService)
```

## Dead Contract Files (2 remaining)

These contract files still exist only because other files import their DTO types. The services themselves are removed.

| Contract file | Imported by | Use instead |
|--------------|-------------|-------------|
| `IMetadataService.ts` | `app/api/metadata/route.ts` (DTO types) | `@/lib/fab-constants` |
| `IBinderStatsService.ts` | `lib/stats/binderStats.ts` (DTO types) | `binderService.getUserBindersWithStats()` |

Once those DTO types are relocated, these files can be deleted.
