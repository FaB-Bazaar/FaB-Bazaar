/**
 * Image-grid tile density for card search results (/opt).
 *
 * The grid always ramps 2 → 3 → 4 columns on small/medium screens (tiles are
 * already large there); the chosen width only caps the lg/xl steps, so "4
 * wide" on a desktop monitor means noticeably bigger, more readable cards.
 *
 * Tailwind needs the full class strings present in source (no template
 * interpolation), hence the explicit map.
 */

export type GridCols = 4 | 5 | 6;

export const GRID_COLS_OPTIONS: readonly GridCols[] = [4, 5, 6];

export const DEFAULT_GRID_COLS: GridCols = 6;

const CLASSES: Record<GridCols, string> = {
  6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5',
  4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4',
};

export function isGridCols(n: unknown): n is GridCols {
  return (GRID_COLS_OPTIONS as readonly unknown[]).includes(n);
}

export function gridColsClass(cols: GridCols | undefined): string {
  return CLASSES[isGridCols(cols) ? cols : DEFAULT_GRID_COLS];
}
