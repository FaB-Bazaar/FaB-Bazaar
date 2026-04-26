# CLAUDE.md - app/wants

Wants list pages: a user's "cards I'm looking for" feature, with an owner view and a public/shared view.

## Routes

| Path | File | Auth | Purpose |
|------|------|------|---------|
| `/wants` | `page.tsx` | Session required | Owner view — manage your own wants list (add / edit quantity / change priority / remove) |
| `/wants/[userId]` | `[userId]/page.tsx` | Public | Read-only view of any user's list with a "shopping cart" selection sidebar for buyers |

Both pages are `"use client"` and fetch data on mount. There is no SSR for these routes.

## Data flow

```
page.tsx ──► wantsClient.* ──► /api/wants/* ──► wantsService (PostgresWantsService)
```

- Owner page uses **`@/lib/client/wants-client`** for all CRUD — never `fetch()` directly.
- Shared page reads via raw `fetch('/api/wants/user/[userId]')` (read-only; no client wrapper needed) and `fetch('/api/users/find?userId=...')` for the display name.
- Shared page is allowed to render even when the viewer is unauthenticated; `useSession()` only drives `isOwnWantsList` for the title.

## Card model (UI shape)

Cards in state look like:

```ts
{
  id: string,                    // printingId — also used as React key + API target
  cardId: string,                // card_unique_id
  name: string,
  quantity: number,
  priority: 'high' | 'medium' | 'low',
  printingDetails: { /* full printing row from search_printings */ }
}
```

`printingDetails.tcg_low` is the canonical price source; the estimated-value calc falls back through `tcg_market → tcg_mid → tcg_high → 0`.

## Shared components

Both pages compose:

- `components/wants/WantsHeader` — title, stats, action buttons (owner only)
- `components/wants/WantsFilterSidebar` — desktop left rail (priority/rarity/foiling/set chips)
- `components/wants/WantsCard` — owner card (editable: qty, priority, printing swap, remove)
- `components/wants/SharedWantsCard` — shared card (selectable up to owner's available qty)
- `lib/fab-constants` — `SET_MAP`, `FOILING_MAP`, `RARITY_MAP` for chip labels and exports

The mobile filter UI is **inlined** in each page (not extracted into the sidebar component). It duplicates the desktop sidebar's chip logic — keep the two in sync when adding a filter axis.

## Owner vs Shared: what's different

| Concern | `/wants` (owner) | `/wants/[userId]` (shared) |
|---------|------------------|----------------------------|
| Default sort | `default` | `price-high` |
| Card actions | qty / priority / printing swap / remove | click-to-select with max = owner's qty |
| Right rail | none | "Selected Cards" cart with copy-as-text |
| Add to list | `CardSearchDialog` | not available |
| Stats header | yes (`WantsHeader`) | inline page header with profile link |
| Export | `Nx Name (SET, Rarity, Foiling)` to clipboard | `Copy List` of selected cart contents |

## Filter / sort model

Same on both pages:

- `activeFilters: { priority, rarity, foiling, set }` — chip click toggles; second click clears
- Plus `searchQuery` (matches `name`; shared page also matches `notes`)
- `activeFilterCount` counts non-null filter axes plus a non-empty search
- Sort options: `default`, `priority`, `price-high`, `price-low`, `name`
- Grid columns adapt to `filterSidebarVisible` — wider grid when the sidebar is hidden

## Known gotchas

- **Printing swap persistence lives in the child, not the parent.** `page.tsx#handlePrintingSwap` only rewrites local state. Persistence happens inside `WantsCard.tsx`'s `PrintingSwapDialog.onSwap`, which does `wantsClient.removeWantsItem(old, skipConfirm=true)` then `wantsClient.addWantsItem(new, qty, priority)`. `onSwapComplete` then fires the parent handler for instant UI feedback. If you ever refactor the parent handler to be the single source of truth, remember to move both API calls up — don't just delete it.
- **`handleEdit` is a stub** — logs to console. Wire to a real edit dialog or remove the prop from `WantsCard`.
- **Shared page used to shadow `getSetName`** — the imported version from `@/lib/card-metadata` is `async` and routes through the deprecated `metadataService`; the local sync version uses `SET_MAP` from `@/lib/fab-constants` (the project-policy path per root CLAUDE.md). The dead import was removed; keep using the local sync helper.
- **Stale "FIX #1" comment** in `[userId]/page.tsx` references a collapsible header that no longer exists. Safe to delete.
- **Mobile filter markup is duplicated** in both pages and not factored into `WantsFilterSidebar`. When you add a filter axis (e.g. set edition), you must edit three places: the sidebar, owner mobile, shared mobile.
- **Optimistic updates without rollback** for `handleQuantityChange` / `handlePriorityChange` (owner) — UI shows the new value before the API confirms, but on failure only an error is logged. `handleRemove` does roll back. Decide consciously per action.
- **`wantsListId` on share** — `handleShare` uses `wantsListData.userId || wantsListData._id`. Prefer `userId` since the route is `/wants/[userId]`; the `_id` fallback dates from MongoDB and should not match the public route shape.
- **No empty-state on owner page when `cards.length === 0`** before any filter — the user just sees "Showing 0 of 0" and the "No cards found" panel that suggests clearing filters (which won't help). Consider a distinct first-run empty state.

## Adding a new field to wants items

1. Migration in `lib/postgres/migrations/` (hand-written SQL — never `drizzle-kit generate`; see root CLAUDE.md).
2. Update `PostgresWantsService` read/write methods + `WantsItemDTO`.
3. Add to `lib/client/wants-client.ts` (`updateWantsItem` body + types).
4. Surface in `WantsCard` (owner) and optionally `SharedWantsCard`.
5. If filterable, add an axis in `WantsFilterSidebar` **and** the mobile filter blocks in both pages.
