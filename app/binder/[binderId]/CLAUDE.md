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
