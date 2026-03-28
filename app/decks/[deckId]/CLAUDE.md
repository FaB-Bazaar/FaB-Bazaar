# Deck Page HUD

See `components/CLAUDE.md` for shared UI/WCAG standards.

## Gotchas

- **`TYPE_KEYS` mapping** — `i→item`, `t→instant` (not swapped). Wrong order breaks Mechanologist decks (no instants → empty results).
- **`isOverlayMode` declaration order** — must be declared *before* `deckDistMap` computation or you get a TDZ `ReferenceError` at runtime.
- **`isTyping` guard** — blocks chord *entry* (`Cmd+K`) but not chord *continuation*. Once a chord is active, keypresses always route to the chord handler regardless of focused input.

## Custom Events

| Event | Direction | Purpose |
|---|---|---|
| `deck-highlight-filter` | dispatch + listen | Filter cards by stat/value; tracked in `activeHighlights` state |
| `deck-highlight-clear` | dispatch + listen | Clear all highlights (double-Escape) |
| `deck-tile-size` | dispatch | Request tile size change (`{ direction: 'smaller' \| 'larger' }`) |
| `deck-tile-size-update` | listen | Sync tile size label from `DeckEditorListView` |
