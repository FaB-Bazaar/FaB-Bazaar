export type DecklistViewMode = 'grid' | 'list';

/**
 * Resolve the decklist's initial view mode: an explicitly saved choice always
 * wins; otherwise narrow viewports read better as a list, desktop as the grid.
 */
export function resolveDecklistViewMode(
  saved: string | null,
  isNarrow: boolean,
): DecklistViewMode {
  if (saved === 'grid' || saved === 'list') return saved;
  return isNarrow ? 'list' : 'grid';
}
