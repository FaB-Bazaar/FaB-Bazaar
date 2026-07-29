/**
 * buildDeckStatsRows — the secondary stats that move into the mobile "Stats"
 * popover, so the pitch chips + decklist stay above the fold.
 */
import { describe, it, expect } from 'vitest';
import { buildDeckStatsRows } from './deck-stats-rows';

const counts = (over: Partial<Record<'weapon' | 'equipment' | 'maindeck' | 'inventory' | 'bench', number>> = {}) => ({
  weapon: 0, equipment: 0, maindeck: 0, inventory: 0, bench: 0, ...over,
});

describe('buildDeckStatsRows', () => {
  it('lists no-pitch, avg cost, then the zone counts in that order', () => {
    const rows = buildDeckStatsRows({
      noPitch: 11,
      averageCost: 2.04,
      sectionCounts: counts({ weapon: 1, equipment: 1, maindeck: 61, inventory: 16, bench: 1 }),
    });
    expect(rows.map(r => r.label)).toEqual([
      'No Pitch', 'Avg Cost', 'Weapons', 'Equipment', 'Maindeck', 'Inventory', 'Bench',
    ]);
    expect(rows.map(r => r.value)).toEqual(['11', '2.0', '1', '1', '61', '16', '1']);
  });

  it('omits zero zone counts and a zero no-pitch count', () => {
    const rows = buildDeckStatsRows({
      noPitch: 0,
      averageCost: 1.5,
      sectionCounts: counts({ maindeck: 60 }),
    });
    expect(rows.map(r => r.label)).toEqual(['Avg Cost', 'Maindeck']);
  });

  it('omits avg cost when the deck has no costed cards', () => {
    const rows = buildDeckStatsRows({
      noPitch: 2,
      averageCost: null,
      sectionCounts: counts(),
    });
    expect(rows.map(r => r.label)).toEqual(['No Pitch']);
  });

  it('returns nothing for an empty deck', () => {
    expect(buildDeckStatsRows({ noPitch: 0, averageCost: null, sectionCounts: counts() })).toEqual([]);
  });
});
