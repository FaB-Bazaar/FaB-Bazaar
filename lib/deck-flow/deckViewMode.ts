export type DeckViewMode = 'list' | 'tile' | 'game';

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
