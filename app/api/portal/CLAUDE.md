# Portal API (authenticated, role-gated)

Surface for content creators to manage their own custom token card creator profile and token cards. All routes require the `isContentCreator` role on `users`.

## Endpoint Summary

| Route | Methods | Gate | Service Calls |
|-------|---------|------|---------------|
| `/api/portal/creator-profile` | GET, POST | `requireContentCreatorRole` | `getCreatorByUserId()`, `createCreatorProfile()` |
| `/api/portal/creator-profile` | PATCH | `requireCreatorProfile` | `updateCreatorProfile()` |
| `/api/portal/token-cards` | GET, POST | `requireCreatorProfile` | `listTokenCardsByCreator()`, `createTokenCard()` |
| `/api/portal/token-cards/[tokenCardId]` | PATCH, DELETE | `requireCreatorProfile` | `updateTokenCard()`, `deleteTokenCard()` |

## Auth helpers (from `@/lib/auth/require-creator`)

Two gates, picked per route based on whether a creator profile must already exist:

- **`requireContentCreatorRole(req)`** — `authenticateRequest` + `userService.hasRole(userId, 'isContentCreator')`. Used when the creator profile may not exist yet (GET/POST profile).
- **`requireCreatorProfile(req)`** — the above + `customTokenCardService.getCreatorByUserId()`. Used by every route that needs to mutate a creator-owned resource.

Both return `{ success: true, userId, creator? } | { success: false, response: NextResponse }`. Routes stay one-liners: `if (!gate.success) return gate.response`.

## Status code conventions

| Scenario | Status |
|---|---|
| No auth / expired session | 401 |
| Authed but not a content creator | 403 |
| Content creator without a profile (on routes requiring one) | 404 |
| Service returns error matching `/not found/i` | 404 |
| Service returns error matching `/not authorized/i` | 403 (ownership violation) |
| Other validation errors | 400 |

## Ownership enforcement

Ownership is enforced **inside the service** (`updateTokenCard` / `deleteTokenCard` compare the caller's `creatorId` against the row's `creator_id`). The route maps the `"Not authorized..."` error to HTTP 403.

**Do not check ownership in the route.** The service is the single source of truth — keeps the check co-located with the mutation, so every caller (REST, future MCP, future GraphQL) gets the same enforcement for free.

## Gotcha: 1:1 creator profile

`custom_token_card_creators.user_id` is `UNIQUE`. A user can have at most one creator profile. `POST /api/portal/creator-profile` errors with 400 + "already exists" if called a second time. To change display name / socials, use `PATCH` instead.
