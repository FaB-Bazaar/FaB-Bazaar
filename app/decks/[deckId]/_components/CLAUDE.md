# The rail deck page (`/decks/[deckId]`, components in `_components/`)

The desktop deck page since 2026-09 (trialled at `/v2`, which now redirects here; the classic page lives on at `/decks/[deckId]/deprecated`): a left rail (Deck · Stats · Prices · Import list · Results · Notes, then after a gap Matchups · Present · Tools ⌘K, and Classic view · Options at the bottom — this page's views first, the links that open another page after the gap) and three views — **Cards** (the classic tile/game grid; EVERY visit opens here — the pick is deliberately not remembered, and the /v2 trial's `deckV2View` localStorage key is ignored), **Table** (one row per card, sortable) and **Brew** (the deck's legal pool minus what's already in it, with add-to-zone buttons). The rail's **Classic view** links to `/deprecated`. Phones (`useIsMobile`) render the classic page instead — resolved after the viewport is known, same timing rule as the classic page.

## Share, don't duplicate

The rail page must reuse the classic page's machinery; a feature that exists on both pages lives in ONE module both import:

- `useDeckEditor` — deck state, add/remove, printing swaps.
- `hooks/deck/useDeckMutations` — add / remove / move / set-quantity for saved deck cards (toast + refresh + optimistic quantity). The rules are in `lib/deck/deck-mutations` (node-tested): every add reads the bulk route's PER-ROW outcome (it answers 200 with `results[i].error` for copy caps / legality), and a move is remove-then-add that puts the copies back when the target zone rejects them — the hand-rolled versions on both pages dropped the cards silently. Never call `decksClient.addPrintings` / `removePrinting` for a deck row from a page.
- `components/deck/editor/DeckEditorListView` — the Cards grid (optional `inPlaceHighlight`, `onHighlightCleared`, `onViewModeChange` props exist for the rail page).
- `components/deck/editor/useDeckCommandHud` — the Cmd+K chord HUD + full-screen focus overlay.
- `hooks/deck/useBinderWantsActions` — collector mode's add-to-binder / add-to-wants.
- `hooks/deck/useDeckOptions` — the Options (More) menu handlers + dialogs (`DeckToolbarMoreMenu` takes a custom `trigger`; `onAnalyze` is optional because the rail page has no Analyze/mat view by owner call).
- `components/deck/editor/DeckBulkImport` — paste-a-decklist.
- `lib/deck/highlight-filters` — `applyHighlightEvent` (the filter-list rules) + `matchesHighlight` (card test). The grid, the Table view and the HUD all use it — never re-implement a stat/type/keyword check inline.

Pure logic (all node-tested) sits in `lib/deck/`: `deck-lens` (panel searches), `deck-prices` (Prices view rows + summary: tcg_low value by zone, bench excluded, owned copies cover a card's pricier rows first so the Buy column sums to the cost to finish from `cardOwnershipMap`; "Compare printings" columns = `cheapestByFinish` over `GET /api/decks/[id]/printing-prices`, English only, bench excluded; Promo = cheapest rarity-`p` printing in any finish; one row per printing, merged across zones — no Zone column), `deck-table` (rows), `brew` (pool filters, facets, starter kits), `ratios`, `hand-odds`, `matchup-names`.

## Highlight sources

Both pages speak the `deck-highlight-filter` / `deck-highlight-clear` window events. The rail page tags panel-driven highlights `source: "panel"` and they apply IN PLACE (matches lift to the top; no overlay); Cmd+K chords keep the classic full-screen focus overlay. The Table view mirrors HUD highlights too (`hudFilters`), so a chord filters whichever view is showing. The rail's **Deck** item resets every filter.

## Main views and deep links

Results, Notes, Import list and Prices (every viewer; `_components/PricesView`) replace the deck views in the main area, embedding the same components as the classic tabs (`DeckResultsTab`, `DeckNotesTab`). `mainMode` is DERIVED from `?tab=` (`lib/deck/deck-page-url`: `resolveMainMode` / `mainModeHref`; rail clicks `history.pushState`, so a view is linkable, survives a reload and Back returns to the deck) — don't add state for it. The Cards / Table / Brew pick is deliberately NOT in the URL (every visit opens on Cards, owner call). The side panels (Deck, Stats) show only beside the deck views (`visiblePanel`); Stats clicked from another view brings the deck back. The panel's **Hide** closes it and keeps the highlight; the **Deck** rail button reopens it as it was, and otherwise resets (or collapses when nothing is highlighted). Below 1200px the panel starts closed. `?tab=notes` / `?tab=results` / `?tab=import` open for editors only — `/decks/[id]/notes` redirects to `?tab=notes`, which works on both pages (phones get the classic page, which reads the same param).

## Brew pool

Server search with the deck's legality (hero classes/talents, format) plus `specializationHero` — drops OTHER heroes' specialization cards (the pool used to offer every hero's). `lib/search/deck-add-filters` passes it for the classic Add Card dialog as well.

## Ratios + hand odds

Saved per deck in `decks.metadata.ratios` via `setDeckRatios` (atomic single-key write; `PUT /api/decks/[deckId]/ratios`, input sanitized by `sanitizeRatios`). A measure is explicit about what it counts — keyword vs card type vs rules text vs pitch — because "mentions Boost" ≠ "has Boost". Counts span main deck + equipment + inventory. Hand odds are a multivariate hypergeometric over the LIBRARY only (main deck, equipment excluded via `classifyDeckZone`), optionally with a saved matchup's in/out swaps applied (Talishar ids).

## e2e

Specs: `e2e/deck-v2-*.spec.ts` + `e2e/deck-page-swap.spec.ts` (local). The deck fixture helpers finish on `/deprecated` because most deck specs drive the classic UI — a spec for the rail page navigates to `/decks/[id]` itself. Run serially (`--workers=1`) — parallel runs overload the dev server and fail at fixture setup. Mutating tests use throwaway decks from `e2e/helpers/deck-fixtures`.
