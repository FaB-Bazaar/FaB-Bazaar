# Deck Page HUD

See `components/CLAUDE.md` for shared UI/WCAG standards.

## Gotchas

- **`[deckId]` is the deck's `public_id`** — internal `decks.id` in a URL/API call 404s even for the owner. When testing, take ids from page links, not the DB.
- **Collector Mode ('unowned' ownership filter) annotates, never hides** — owned tiles get a binder link, unowned get add-to-binder/wants buttons. Deliberate (user feedback, 2026-07); don't "fix" it to filter. Helpers + contract tests: `components/deck/editor/collector-mode.ts`.
- **Mobile opens in list view, and the default is timing-sensitive** — `resolveDefaultDeckViewMode(canEdit, isMobile)` returns `list` on narrow viewports (desktop keeps tile-for-editors / game-for-viewers). `DeckEditorListView` locks its view mode on the FIRST non-null `defaultViewMode`, and `useIsMobile` returns `false` until its mount effect reads matchMedia — so the page withholds `defaultViewMode` (`undefined`) until a `viewportResolved` flag flips, or phones lock to the desktop default.
- **Mobile stats live in a popover** — the top of the deck tab is two chip rows on mobile: `[Kits · Explore · Stats]` then `[Total · Red · Yellow · Blue]`. No Pitch / Avg Cost / zone counts move into `DeckStatsPopover` (rows built by `buildDeckStatsRows`); the inline chips are `hidden sm:*`. Chip labels shrink at `<sm` ("Starter Kits" → "Kits") to keep row one from wrapping — re-measure if you add a fourth chip. The hover-preview and tile-density controls are already gated to tile/game views, so list view shows only List/Tiles/Game.
- **`TYPE_KEYS` mapping** — `i→item`, `t→instant` (not swapped). Wrong order breaks Mechanologist decks (no instants → empty results).
- **`isOverlayMode` declaration order** — must be declared *before* `deckDistMap` computation or you get a TDZ `ReferenceError` at runtime.
- **`isTyping` guard** — blocks chord *entry* (`Cmd+K`) but not chord *continuation*. Once a chord is active, keypresses always route to the chord handler regardless of focused input.
- **Pitch stats must scan all three arrays** — `maindeck + inventory + equipment`. Scanning only maindeck/inventory misses cards added via the search tab (which runs `inferCategory()` and assigns equipment-typed cards to `equipment` category).
- **Card category ≠ card type** — Chord shortcuts (Cmd+9 → `maindeck`, Cmd+8 → `inventory`) bypass `inferCategory()`, so the same equipment-typed card can land in different categories depending on how it was added.
- **Turn attribution in game replay** — Some heroes (e.g. Guardians) activate weapons as `"M"` actions even on the opponent's turn. `tOppAttacks ? false` alone is wrong; when both players have `"M"` actions, fall back to parity (`idx % 2 === playerTurnIdx`). The sort also uses `turnIdx % 2 === playerTurnIdx`, not `turnIdx === playerTurnIdx`.
- **Turn log card images — tokens & removed cards** — Cards like `gold` (Gravy Bones token) are never in `deck.maindeck/equipment/hero`, so the slug lookup misses them. Cards removed from the deck since a game was played also fail. The list endpoint (`GET /api/decks/[deckId]/results`) inlines an `imageUrls` map per game, server-resolved via `cards.talishar_card_id` → first printing's `image_url`. Detail (`GET /results/[resultId]`) extends the map to turn-log cardIds, applying `normalizeTalisharId` to strip Talishar's state suffixes (`_equip`, `_ally`, `_r`, alt-art set prefixes). `DeckResultsTab` lazy-fetches detail on row expand and caches it in `detailById`.

- **Playwright vs presenter fit view** — the cookie banner intercepts clicks (pre-seed localStorage `cookieConsent` + `cookieConsentOptions` via addInitScript); fit-view tiles overlap, so click a tile's top ~30% or use dispatchEvent('click'). `e2e/deck-presenter.spec.ts` selectors predate the fit-view default and need updating.
- **Mobile fit view clips lanes** — the lane row is `overflow-hidden`; narrow viewports cut off outer columns (known, unfixed).
- **QuickAddCardDialog name search is card-grouped** — it sends `groupByCard=true` so the result `limit` counts CARDS, not printings (else a heavily-reprinted card like "Gustwave", 100+ printings, crowds every other match off the page). Each row is one card carrying `printing_count` → `__printingsCount`; the full printing list is lazy-loaded on select via `fetchPrintingsForCard` (`/api/cards/[cardUniqueId]/printings`). Matching is `searchMode=strict` (substring, accent-insensitive) by default with a Strict/Fuzzy toggle (`fuzzy` state) to opt into `word_similarity`. Swap mode (`initialSearch`) stays flat/ungrouped — it needs every printing of one exact card.

## Custom Events

| Event | Direction | Purpose |
|---|---|---|
| `deck-highlight-filter` | dispatch + listen | Filter cards by stat/value; tracked in `activeHighlights` state |
| `deck-highlight-clear` | dispatch + listen | Clear all highlights (double-Escape) |
| `deck-tile-size` | dispatch | Request tile size change (`{ direction: 'smaller' \| 'larger' }`) |
| `deck-tile-size-update` | listen | Sync tile size label from `DeckEditorListView` |
