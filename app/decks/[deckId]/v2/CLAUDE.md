# Deck page v2 (`/decks/[deckId]/v2`)

Experimental desktop deck page: a left rail (Deck · Stats · Matchups · Import list · Results · Notes · Present · Tools ⌘K · Classic view · Options) and three views — **Cards** (the classic tile/game grid; the default, a viewer's own pick is remembered in localStorage), **Table** (one row per card, sortable) and **Brew** (the deck's legal pool minus what's already in it, with add-to-zone buttons). No in-app links point here yet; testers type `/v2` onto a deck URL. Phones (`useIsMobile`) render the classic page instead — resolved after the viewport is known, same timing rule as the classic page.

## Share, don't duplicate

v2 must reuse the classic page's machinery; a feature that exists on both pages lives in ONE module both import:

- `useDeckEditor` — deck state, add/remove, printing swaps.
- `components/deck/editor/DeckEditorListView` — the Cards grid (optional `inPlaceHighlight`, `onHighlightCleared`, `onViewModeChange` props exist for v2).
- `components/deck/editor/useDeckCommandHud` — the Cmd+K chord HUD + full-screen focus overlay.
- `hooks/deck/useBinderWantsActions` — collector mode's add-to-binder / add-to-wants.
- `hooks/deck/useDeckOptions` — the Options (More) menu handlers + dialogs (`DeckToolbarMoreMenu` takes a custom `trigger`; `onAnalyze` is optional because v2 has no Analyze/mat view by owner call).
- `components/deck/editor/DeckBulkImport` — paste-a-decklist.
- `lib/deck/highlight-filters` — `applyHighlightEvent` (the filter-list rules) + `matchesHighlight` (card test). The grid, the Table view and the HUD all use it — never re-implement a stat/type/keyword check inline.

Pure logic (all node-tested) sits in `lib/deck/`: `deck-lens` (panel searches), `deck-table` (rows), `brew` (pool filters, facets, starter kits), `ratios`, `hand-odds`, `matchup-names`.

## Highlight sources

Both pages speak the `deck-highlight-filter` / `deck-highlight-clear` window events. v2 tags panel-driven highlights `source: "panel"` and they apply IN PLACE (matches lift to the top; no overlay); Cmd+K chords keep the classic full-screen focus overlay. The Table view mirrors HUD highlights too (`hudFilters`), so a chord filters whichever view is showing. The rail's **Deck** item resets every filter.

## Brew pool

Server search with the deck's legality (hero classes/talents, format) plus `specializationHero` — drops OTHER heroes' specialization cards (the pool used to offer every hero's). `lib/search/deck-add-filters` passes it for the classic Add Card dialog as well.

## Ratios + hand odds

Saved per deck in `decks.metadata.ratios` via `setDeckRatios` (atomic single-key write; `PUT /api/decks/[deckId]/ratios`, input sanitized by `sanitizeRatios`). A measure is explicit about what it counts — keyword vs card type vs rules text vs pitch — because "mentions Boost" ≠ "has Boost". Counts span main deck + equipment + inventory. Hand odds are a multivariate hypergeometric over the LIBRARY only (main deck, equipment excluded via `classifyDeckZone`), optionally with a saved matchup's in/out swaps applied (Talishar ids).

## e2e

Specs: `e2e/deck-v2-*.spec.ts` (local). Run serially (`--workers=1`) — parallel runs overload the dev server and fail at fixture setup. Mutating tests use throwaway decks from `e2e/helpers/deck-fixtures`.
