# Creators API (public)

Public read-only endpoints for fan-made custom token card creators. All routes use `customTokenCardService` from `@/lib/services`.

## Endpoint Summary

| Route | Methods | Service Calls |
|-------|---------|---------------|
| `/api/creators` | GET | `listCreators()` |
| `/api/creators/[slug]` | GET | `getCreatorBySlug()`, `getPublishedTokenCardsByCreator()` |

## Notes

- **No auth.** These are public profile endpoints. Anyone can browse the creator index.
- **Published-only scope.** `GET /api/creators/[slug]` returns the creator + only their `isPublished=true` token cards. Draft cards live behind `/api/portal/token-cards` (auth required).
- **Combined response.** `/api/creators/[slug]` returns `{ creator, tokenCards }` in a single round-trip. Frontend renders both together — no reason to split.
- **`tokenCardCount`** on the list response reflects published cards only.

## Related routes

- `/api/token-cards/[tokenCardId]` — fetch a single token card by id (public)
- `/api/portal/creator-profile`, `/api/portal/token-cards/*` — authenticated portal surface
