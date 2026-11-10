// Brew tab card sizes. Small is the original tile; the larger steps make the
// printed text readable without opening the details panel.

// `label` is what the picker shows, `name` its accessible name. XL is sized to
// fit three per row in the pool on a ~2000px window; narrower windows get fewer.
export const BREW_TILE_SIZES = [
  { label: "S", name: "Small", width: 120 },
  { label: "M", name: "Medium", width: 170 },
  { label: "L", name: "Large", width: 230 },
  { label: "XL", name: "Extra large", width: 440 },
] as const;

export const DEFAULT_BREW_TILE_SIZE = 0;

/** localStorage key for the viewer's pick (a per-viewer convenience). */
export const BREW_TILE_SIZE_KEY = "deck-brew-tile-size";

export function stepBrewTileSize(idx: number, direction: 1 | -1): number {
  return Math.min(BREW_TILE_SIZES.length - 1, Math.max(0, idx + direction));
}

/** A saved size index, or the default for anything unreadable. */
export function parseBrewTileSize(raw: string | null): number {
  const n = raw == null || raw === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 && n < BREW_TILE_SIZES.length ? n : DEFAULT_BREW_TILE_SIZE;
}
