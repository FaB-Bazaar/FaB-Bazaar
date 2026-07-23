export type DeckViewMode = 'list' | 'tile' | 'game';

/**
 * Initial view for the deck page: owners/co-owners get the editable tile view;
 * everyone else is browsing, so they get the read-oriented game view.
 */
export function resolveDefaultDeckViewMode(canEdit: boolean): DeckViewMode {
  return canEdit ? 'tile' : 'game';
}
