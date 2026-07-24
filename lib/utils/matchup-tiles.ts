// Tile list for the matchups grid (DeckMatchupsDialog): every legal opponent
// in the deck's format gets a tile, whether or not a plan exists yet.

export interface TileHeroOption {
  talisharId: string;
  displayName: string;
  classes: string[];
}

// Ids (core / strategy preset / hero talishar ids) that have no configured
// matchup yet, ordered to mirror the configured grid: core first, then
// strategy presets, then heroes sorted by primary class, then display name.
export function getUnconfiguredMatchupTiles(
  configured: { heroId: string }[],
  heroOptions: TileHeroOption[],
  special: { coreId: string; strategyIds: string[] }
): string[] {
  const taken = new Set(configured.map(m => m.heroId));

  const presets = [special.coreId, ...special.strategyIds].filter(id => !taken.has(id));

  const heroes = heroOptions
    .filter(h => !taken.has(h.talisharId))
    .sort((a, b) => {
      const cls = (a.classes[0] ?? 'zzz_other').localeCompare(b.classes[0] ?? 'zzz_other');
      if (cls !== 0) return cls;
      return a.displayName.localeCompare(b.displayName);
    })
    .map(h => h.talisharId);

  return [...presets, ...heroes];
}
