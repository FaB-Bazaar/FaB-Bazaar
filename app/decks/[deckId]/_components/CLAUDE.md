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

## Header (2026-11)

`DeckHeader`: the hero's art (the tile crop of `deck.hero[0]`), the name, the hero · format · size line and the pitch split as a bar with written counts (`pitchSplit`, so main deck + equipment + inventory, like the Stats panel). The art is a button that opens the hero in `CardDetailsLightbox` — the header owns that lightbox (same shape as `DeckTable`'s) because it shows on every view, not only beside the grid. Flat fills only. Pinned with the closed-panel default in `e2e/regression/deck-landing.spec.ts`.

## Add cards button + Table actions (2026-11)

A plain **Add cards** button sits beside Table / Cards / Brew (editors; hidden on Brew, which is itself the add view) and opens `QuickAddCardDialog` for the main deck — the dialog names the zone ("Adding to: Library"). In the **Table**, a card's name is a button that opens `CardDetailsLightbox` (the lightbox leaves Escape to its host, so `DeckTable` closes it), and the Zone cell is a borderless `<select>` that moves the whole row (`moveRow` in the page → `mutations.move` per printing). Which zones a card may go to lives in `lib/deck/zone-compat` (`moveTargets`, `isEquipmentCompatible`, `isLibraryCompatible`) — the card grid's move buttons import the same functions. Table control labels carry the pitch ("Mocking Blow (red)") because pitch variants share a name.

## Highlight sources

Both pages speak the `deck-highlight-filter` / `deck-highlight-clear` window events. The rail page tags panel-driven highlights `source: "panel"` and they apply IN PLACE (matches lift to the top; no overlay); Cmd+K chords keep the classic full-screen focus overlay. The Table view mirrors HUD highlights too (`hudFilters`), so a chord filters whichever view is showing. The rail's **Deck** item resets every filter.

## Main views and deep links

Results, Notes, Import list and Prices (every viewer; `_components/PricesView`) replace the deck views in the main area, embedding the same components as the classic tabs (`DeckResultsTab`, `DeckNotesTab`). `mainMode` is DERIVED from `?tab=` (`lib/deck/deck-page-url`: `resolveMainMode` / `mainModeHref`; rail clicks `history.pushState`, so a view is linkable, survives a reload and Back returns to the deck) — don't add state for it. The Cards / Table / Brew pick is deliberately NOT in the URL (every visit opens on Cards, owner call). The side panels (Deck, Stats) show only beside the deck views (`visiblePanel`); Stats clicked from another view brings the deck back. The panel's **Hide** closes it and keeps the highlight; the **Deck** rail button reopens it as it was, and otherwise resets (or collapses when nothing is highlighted). The Find panel STARTS CLOSED (2026-11: a deck opens on its cards, full width); a browser that opened it gets it open next time (`deck-find-panel-open` in localStorage, ignored below 1200px) — a spec that uses the panel sets that key or clicks **Deck** first. `?tab=notes` / `?tab=results` / `?tab=import` open for editors only — `/decks/[id]/notes` redirects to `?tab=notes`, which works on both pages (phones get the classic page, which reads the same param).

## Brew pool

Server search with the deck's legality (hero classes/talents, format) plus `specializationHero` — drops OTHER heroes' specialization cards (the pool used to offer every hero's). `lib/search/deck-add-filters` passes it for the classic Add Card dialog as well.

**Speed (2026-11):** Brew is mounted on first use and then KEPT (hidden) while Table / Cards show, so coming back runs no second search or starter-kit fetch. A hidden Brew must do nothing: its search filters follow the Find panel only while `visible` (a row clicked in Cards must not run a Brew search) and the details column is not portalled — any new effect in `BrewView` needs the same `visible` guard. It still unmounts when the main view changes (Prices, Results, …). Tiles reserve the card's 63:88 shape before the art loads; a 0px-tall tile put all 60 lazy images AND the paging sentinel in the viewport, so everything plus page 2 loaded at once. An add takes the deck from the add call's own response (`mergeServerDeck` keeps the viewer fields GET adds) instead of requesting the deck again; overlapping mutations (fast +1 clicks) finish with ONE refetch because their responses can land out of order (`createSettleTracker`). Pinned in `e2e/regression/deck-brew-speed.spec.ts` + `deck-full-card-view.spec.ts`.

**Card size** (S / M / L / XL, `lib/deck/brew-tile-size`; remembered per browser): S is the original 120px tile, XL (440px) fits three per row in the pool on a ~2000px window and fewer on narrower ones. The picker is plain underlined text, the same idiom as the deck's layout picker — not a boxed control.

## Ratios + hand odds

Saved per deck in `decks.metadata.ratios` via `setDeckRatios` (atomic single-key write; `PUT /api/decks/[deckId]/ratios`, input sanitized by `sanitizeRatios`). A measure is explicit about what it counts — keyword vs card type vs rules text vs pitch — because "mentions Boost" ≠ "has Boost". Counts span main deck + equipment + inventory. Hand odds are a multivariate hypergeometric over the LIBRARY only (main deck, equipment excluded via `classifyDeckZone`), optionally with a saved matchup's in/out swaps applied (Talishar ids).

## e2e

Specs: `e2e/deck-v2-*.spec.ts` + `e2e/deck-page-swap.spec.ts` (local). The deck fixture helpers finish on `/deprecated` because most deck specs drive the classic UI — a spec for the rail page navigates to `/decks/[id]` itself. Run serially (`--workers=1`) — parallel runs overload the dev server and fail at fixture setup. Mutating tests use throwaway decks from `e2e/helpers/deck-fixtures`.
