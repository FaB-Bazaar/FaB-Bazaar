// 'full' is the tile view with the whole card face (not the cropped tile); it
// is never a default — a viewer picks it.
export type DeckViewMode = 'list' | 'tile' | 'full' | 'game';

/** Modes drawn as a grid of cards: they share the size, hover-preview and highlight controls. */
export function isCardGridMode(mode: DeckViewMode): boolean {
  return mode !== 'list';
}

// Card width in px per size step (Compact / Normal / Large). Full cards are
// drawn wider so the printed text can be read.
const TILE_WIDTHS = [108, 150, 200];
const FULL_WIDTHS = [150, 200, 260];

export function deckTileWidth(mode: DeckViewMode, sizeIdx: number): number {
  const widths = mode === 'full' ? FULL_WIDTHS : TILE_WIDTHS;
  return widths[Math.min(widths.length - 1, Math.max(0, sizeIdx))];
}

/**
 * Initial view for the deck page: on mobile the decklist itself is the point —
 * tiles/game push it below a wall of chips — so narrow viewports open in list
 * view. On desktop, owners/co-owners get the editable tile view; everyone else
 * is browsing, so they get the read-oriented game view.
 */
export function resolveDefaultDeckViewMode(canEdit: boolean, isMobile = false): DeckViewMode {
  if (isMobile) return 'list';
  return canEdit ? 'tile' : 'game';
}
