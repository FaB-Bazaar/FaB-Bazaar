# Collection Module

Aggregated view of a user's cards across all binders.

## Endpoints

| Route | Service Call | Notes |
|-------|-------------|-------|
| `GET /api/collection` | `binderService.getUserBindersWithStats()` | Aggregates stats across all binders in real-time |
| `GET /api/collection/all-cards` | `binderService.getAllCardsForUser(filters, options)` | Paginated, filterable |
| `GET /api/collection/cards?q=` | `binderService.searchUserCards(userId, query, 50)` | Min 3 chars, groups by card with binder locations |

Stats are computed by aggregating per-binder stats (no separate cron job). See `app/api/binders/CLAUDE.md` for how binder stats work.
