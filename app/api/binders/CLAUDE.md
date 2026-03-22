# Binder API

Card collection management. All routes use `binderService` from `@/lib/services`.

## Endpoint Summary

| Route | Methods | Key Service Calls |
|-------|---------|-------------------|
| `/api/binders` | GET, POST | `listUserBinders()`, `createBinder()` |
| `/api/binders/[binderId]` | GET, PUT, DELETE | `getBinder()`, `updateBinder()`, `deleteBinder()` |
| `/api/binders/[binderId]/cards` | GET, POST | `getBinder()`, `addCardToBinder()` |
| `/api/binders/[binderId]/cards/[cardId]` | GET, PUT, DELETE | `getBinderCard()`, `updateBinderCard()`, `deleteBinderCard()` |
| `/api/binders/[binderId]/bulk-update` | PATCH | `bulkUpdateCards()` |
| `/api/binders/[binderId]/copy` | POST | `getBinder()`, `copyBinder()` |
| `/api/binders/[binderId]/export` | GET | `getBinder()`, `getBinderCardsForExport()` |
| `/api/binders/transfer` | POST | Transfer cards between binders |
| `/api/users/[userId]/binders` | GET | `getUserBindersWithStats()` — public profile endpoint |

## ID-Only Lookups (Web API)

All web API routes accept **binder IDs only**, never slugs. Slug-based lookup (`findBinderByIdOrSlug`) is reserved for Discord and MCP integrations, which always scope by userId. This prevents cross-user collisions since slugs are not globally unique.

## Stats Architecture

- **Dirty flag pattern**: Card changes mark binder with `statsNeedUpdate: true`
- **Cron job** (`/api/cron/update-binder-stats`): Processes 100 dirty binders per run
- **Immediate recalc**: High-value cards (M/L/F/V rarity) trigger instant stats update
- Routes should never calculate stats — let the service + cron handle it

## User Binders Endpoint (`/api/users/[userId]/binders`)

Public-facing endpoint for profile pages. Query params:
- `includeStats=true` — full binder statistics (quantities, values, rarity counts)
- `includeShowcase=true` — featured cards for profile display

Rate limited (30 req/min per IP). Responses cached 5 minutes. Only returns public binders.

## Copy Behavior

`copyBinder()` enforces privacy: all copied cards set to `forTrade: false`. Generates unique slug with `copy-` prefix.

## Slug Usage

Slugs exist as binder metadata for display (e.g., navbar, profile URLs). They are **not** used as identifiers in web API routes. Discord/MCP use `findBinderByIdOrSlug(slug, userId)` and `getOrCreateBinderBySlug(userId, slug)` — always scoped to a specific user.
