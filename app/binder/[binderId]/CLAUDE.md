# Binder Page HUD

See `components/CLAUDE.md` for shared UI/WCAG standards.

## Chord Modes

`null → select → rarity | foiling | set | class | clear`

- `set` and `class` use a full-screen modal overlay (already accessible — keep as-is)
- `rarity` and `foiling` use the fixed bottom chip overlay pattern

## Gotchas

- **Active filter state** — read `activeFilters.rarity`, `activeFilters.foiling` etc. directly in render. No separate `activeHighlights` map needed (unlike the deck page).
- **`exitChord`** — uses 160ms delay to allow `chord-chip-exit` animation. Don't call `setChordMode(null)` directly from chip click handlers.
- **Rarity/foiling codes are lowercase** — `activeFilters.rarity === 'f'` (not `'F'`). Chip `code` fields must be lowercase to match.
- **`sortBy` is `null` until the binder loads** — initial sort resolves from `binder.defaultSort` (fallback: `name` when `hideValue`, else `tcg-low-desc`); the cards fetch effect gates on it. New consumers of `sortBy` must handle `null`.
- **Tests must not add cards to a binder** — `POST /api/binders/[id]/cards` posts to a live Discord channel from the SERVER when the binder allows webhooks, so a browser-side route mock can't stop it once the request is sent. e2e specs for the add dialog stay read-only and abort binder writes (`blockWrites` in `e2e/regression/card-search-dialog-speed.spec.ts`); test add behaviour at the service/route layer with the webhook mocked.
- **Add dialog (`components/dialogs/cards/card-search-dialog.tsx`, shared with wants / articles / Volzar)** — set / foiling / edition / rarity names come from `lib/cards/printing-labels` (compiled constants); it no longer fetches `/api/metadata` on mount, and the old lookup's `r.code === r.code` made every printing read "Common". Search debounce is 250 ms and each search aborts the previous one — the short-query branch clears the spinner itself because an aborted search never does.
