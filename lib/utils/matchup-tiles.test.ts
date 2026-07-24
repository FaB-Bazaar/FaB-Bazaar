import { describe, it, expect } from 'vitest';
import { getUnconfiguredMatchupTiles, type TileHeroOption } from './matchup-tiles';

const CORE = 'core';
const STRATEGIES = ['aggro', 'fatigue', 'combo', 'midrange'];

const hero = (talisharId: string, displayName: string, classes: string[]): TileHeroOption => ({
  talisharId,
  displayName,
  classes,
});

const HEROES = [
  hero('ira_crimson_haze', 'Ira, Crimson Haze', ['Ninja']),
  hero('katsu_the_wanderer', 'Katsu, The Wanderer', ['Ninja']),
  hero('bravo_showstopper', 'Bravo, Showstopper', ['Guardian']),
  hero('valda_brightaxe', 'Valda Brightaxe', ['Guardian']),
];

describe('getUnconfiguredMatchupTiles', () => {
  it('lists core, then strategies, then heroes when nothing is configured', () => {
    const tiles = getUnconfiguredMatchupTiles([], HEROES, {
      coreId: CORE,
      strategyIds: STRATEGIES,
    });
    expect(tiles.slice(0, 5)).toEqual([CORE, ...STRATEGIES]);
    expect(tiles).toHaveLength(5 + HEROES.length);
  });

  it('excludes heroes and presets that already have a matchup', () => {
    const configured = [
      { heroId: CORE },
      { heroId: 'fatigue' },
      { heroId: 'ira_crimson_haze' },
    ];
    const tiles = getUnconfiguredMatchupTiles(configured, HEROES, {
      coreId: CORE,
      strategyIds: STRATEGIES,
    });
    expect(tiles).not.toContain(CORE);
    expect(tiles).not.toContain('fatigue');
    expect(tiles).not.toContain('ira_crimson_haze');
    expect(tiles).toContain('aggro');
    expect(tiles).toContain('katsu_the_wanderer');
  });

  it('sorts heroes by primary class, then display name (matching the configured grid)', () => {
    const tiles = getUnconfiguredMatchupTiles([], HEROES, {
      coreId: CORE,
      strategyIds: [],
    });
    expect(tiles).toEqual([
      CORE,
      'bravo_showstopper',
      'valda_brightaxe',
      'ira_crimson_haze',
      'katsu_the_wanderer',
    ]);
  });

  it('returns only unconfigured presets when there are no hero options', () => {
    const tiles = getUnconfiguredMatchupTiles([{ heroId: 'aggro' }], [], {
      coreId: CORE,
      strategyIds: STRATEGIES,
    });
    expect(tiles).toEqual([CORE, 'fatigue', 'combo', 'midrange']);
  });
});
