# Deck Page HUD

See `components/CLAUDE.md` for shared UI/WCAG standards.

## Gotchas

- **`TYPE_KEYS` mapping** — `i→item`, `t→instant` (not swapped). Wrong order breaks Mechanologist decks (no instants → empty results).
- **`isOverlayMode` declaration order** — must be declared *before* `deckDistMap` computation or you get a TDZ `ReferenceError` at runtime.
- **`isTyping` guard** — blocks chord *entry* (`Cmd+K`) but not chord *continuation*. Once a chord is active, keypresses always route to the chord handler regardless of focused input.
- **Pitch stats must scan all three arrays** — `maindeck + inventory + equipment`. Scanning only maindeck/inventory misses cards added via the search tab (which runs `inferCategory()` and assigns equipment-typed cards to `equipment` category).
- **Card category ≠ card type** — Chord shortcuts (Cmd+9 → `maindeck`, Cmd+8 → `inventory`) bypass `inferCategory()`, so the same equipment-typed card can land in different categories depending on how it was added.
- **Turn attribution in game replay** — Some heroes (e.g. Guardians) activate weapons as `"M"` actions even on the opponent's turn. `tOppAttacks ? false` alone is wrong; when both players have `"M"` actions, fall back to parity (`idx % 2 === playerTurnIdx`). The sort also uses `turnIdx % 2 === playerTurnIdx`, not `turnIdx === playerTurnIdx`.
- **Turn log card images — tokens & removed cards** — Cards like `gold` (Gravy Bones token) are never in `deck.maindeck/equipment/hero`, so the slug lookup misses them. Cards removed from the deck since a game was played also fail. The list endpoint (`GET /api/decks/[deckId]/results`) inlines an `imageUrls` map per game, server-resolved via `cards.talishar_card_id` → first printing's `image_url`. Detail (`GET /results/[resultId]`) extends the map to turn-log cardIds, applying `normalizeTalisharId` to strip Talishar's state suffixes (`_equip`, `_ally`, `_r`, alt-art set prefixes). `DeckResultsTab` lazy-fetches detail on row expand and caches it in `detailById`.

## Custom Events

| Event | Direction | Purpose |
|---|---|---|
| `deck-highlight-filter` | dispatch + listen | Filter cards by stat/value; tracked in `activeHighlights` state |
| `deck-highlight-clear` | dispatch + listen | Clear all highlights (double-Escape) |
| `deck-tile-size` | dispatch | Request tile size change (`{ direction: 'smaller' \| 'larger' }`) |
| `deck-tile-size-update` | listen | Sync tile size label from `DeckEditorListView` |
