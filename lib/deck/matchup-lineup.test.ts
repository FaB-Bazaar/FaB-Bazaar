/**
 * matchup-lineup — declarative "here is the active list for this matchup"
 * → sideboard in/out swaps.
 *
 * Mirrors the matchup tile editor (components/deck/MatchupSideboardEditor):
 * pool = hero + equipment + maindeck (base) + inventory (bench), grouped by
 * Talishar id (name + pitch colour, printing-agnostic). Each card has
 * `available` (copies in the pool) and `baseCount` (copies in the base deck).
 * A lineup sets each card's ACTIVE count; anything unlisted is 0 (greyed).
 * in/out = active − base, per copy.
 */
import { describe, it, expect } from 'vitest';
import { buildMatchupPool, computeLineupSwaps, lineupCardId, type LineupEntry } from './matchup-lineup';

const p = (name: string, pitch: number | null, quantity: number, types: string[] = ['action']) => ({
  printingId: 'p_' + name.replace(/\W/g, '') + pitch,
  quantity,
  printingDetails: { name, display_name: name, pitch: pitch ?? undefined, types },
});

const deck = {
  hero: [p("Maxx 'The Hype' Nitro", 0, 1, ['hero', 'mechanologist'])],
  equipment: [
    p('Adaptive Alpha Mold', 0, 1, ['equipment', 'head']),
    p('Cogwerx Blunderbuss', 0, 1, ['weapon', 'gun']),
  ],
  maindeck: [
    p('Command and Conquer', 1, 3, ['attack action']),
    p('Sink Below', 1, 3, ['defense reaction']),
    p('Sink Below', 3, 2, ['defense reaction']),
    p('Evo Mach Breaker', 1, 1, ['equipment', 'evo', 'arms']),
  ],
  inventory: [
    p('Sink Below', 3, 1, ['defense reaction']),      // 3rd copy lives in inventory
    p('Unmovable', 1, 2, ['defense reaction']),
    p('Adaptive Dissolver', 0, 1, ['equipment', 'chest']),
  ],
};

describe('lineupCardId', () => {
  it('builds Talishar ids: name + pitch colour, none for unpitched', () => {
    expect(lineupCardId('Sink Below', 3)).toBe('sink_below_blue');
    expect(lineupCardId('Command and Conquer', 1)).toBe('command_and_conquer_red');
    expect(lineupCardId('Adaptive Alpha Mold', 0)).toBe('adaptive_alpha_mold');
    expect(lineupCardId('Adaptive Alpha Mold', null)).toBe('adaptive_alpha_mold');
  });
});

describe('buildMatchupPool', () => {
  it('groups by Talishar id with available = pool copies and baseCount = base-deck copies', () => {
    const pool = buildMatchupPool(deck);
    expect(pool.get('sink_below_blue')).toMatchObject({ available: 3, baseCount: 2, section: 'library' });
    expect(pool.get('sink_below_red')).toMatchObject({ available: 3, baseCount: 3 });
    expect(pool.get('unmovable_red')).toMatchObject({ available: 2, baseCount: 0 });
  });

  it('puts weapons + non-Evo equipment in the equipment section, Evo in library, hero in hero', () => {
    const pool = buildMatchupPool(deck);
    expect(pool.get('cogwerx_blunderbuss')?.section).toBe('equipment');
    expect(pool.get('adaptive_dissolver')?.section).toBe('equipment');
    expect(pool.get('evo_mach_breaker_red')?.section).toBe('library');
    expect(pool.get('maxx_the_hype_nitro')?.section).toBe('hero');
  });
});

describe('computeLineupSwaps', () => {
  const pool = buildMatchupPool(deck);
  const base: LineupEntry[] = [
    { cardName: 'Adaptive Alpha Mold', quantity: 1 },
    { cardName: 'Cogwerx Blunderbuss', quantity: 1 },
    { cardName: 'Command and Conquer', pitch: 1, quantity: 3 },
    { cardName: 'Sink Below', pitch: 1, quantity: 3 },
    { cardName: 'Sink Below', pitch: 3, quantity: 2 },
    { cardName: 'Evo Mach Breaker', pitch: 1, quantity: 1 },
  ];

  it('a lineup identical to the base deck yields no swaps', () => {
    const r = computeLineupSwaps(pool, base);
    expect(r.ok).toBe(true);
    expect(r.in).toEqual([]);
    expect(r.out).toEqual([]);
  });

  it('an unlisted base card is fully sided out (one id per copy)', () => {
    const r = computeLineupSwaps(pool, base.filter(e => e.cardName !== 'Command and Conquer'));
    expect(r.ok).toBe(true);
    expect(r.out).toEqual(['command_and_conquer_red', 'command_and_conquer_red', 'command_and_conquer_red']);
  });

  it('reducing a count sides out only the difference; listing an inventory card sides it in', () => {
    const lineup = base
      .map(e => (e.cardName === 'Sink Below' && e.pitch === 1 ? { ...e, quantity: 1 } : e))
      .concat([{ cardName: 'Unmovable', pitch: 1, quantity: 2 }]);
    const r = computeLineupSwaps(pool, lineup);
    expect(r.ok).toBe(true);
    expect(r.out).toEqual(['sink_below_red', 'sink_below_red']);
    expect(r.in).toEqual(['unmovable_red', 'unmovable_red']);
  });

  it('activating the inventory copy of a card that is also in the base deck is an "in"', () => {
    const lineup = base.map(e => (e.cardName === 'Sink Below' && e.pitch === 3 ? { ...e, quantity: 3 } : e));
    const r = computeLineupSwaps(pool, lineup);
    expect(r.ok).toBe(true);
    expect(r.in).toEqual(['sink_below_blue']);
    expect(r.out).toEqual([]);
  });

  it('never sides the hero out even when the lineup omits it', () => {
    const r = computeLineupSwaps(pool, base);
    expect(r.out).not.toContain('maxx_the_hype_nitro');
  });

  it('errors when a card asks for more copies than the pool holds', () => {
    const r = computeLineupSwaps(pool, base.concat([{ cardName: 'Unmovable', pitch: 1, quantity: 3 }]));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Unmovable/);
    expect(r.errors[0]).toMatch(/3/);
    expect(r.errors[0]).toMatch(/2/);
  });

  it('errors when a card is not in the pool at all and points at the inventory zone', () => {
    const r = computeLineupSwaps(pool, base.concat([{ cardName: 'Fyendal Spring Tunic', quantity: 1 }]));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Fyendal Spring Tunic/);
    expect(r.errors[0]).toMatch(/inventory/i);
  });

  it('sums duplicate entries for the same card and accepts raw Talishar ids', () => {
    const lineup = base
      .filter(e => !(e.cardName === 'Sink Below' && e.pitch === 1))
      .concat([{ cardId: 'sink_below_red', quantity: 1 }, { cardName: 'Sink Below', pitch: 1, quantity: 1 }]);
    const r = computeLineupSwaps(pool, lineup);
    expect(r.ok).toBe(true);
    expect(r.out).toEqual(['sink_below_red']);
  });

  it('reports library and equipment deltas on separate bases, like the editor stats bar', () => {
    const lineup = base
      .filter(e => e.cardName !== 'Adaptive Alpha Mold' && e.cardName !== 'Command and Conquer')
      .concat([{ cardName: 'Adaptive Dissolver', quantity: 1 }]);
    const r = computeLineupSwaps(pool, lineup);
    expect(r.stats.library).toEqual({ before: 9, after: 6, out: 3, in: 0 });
    expect(r.stats.equipment).toEqual({ before: 2, after: 2, out: 1, in: 1 });
  });

  it('lists per-card changes with human names for the response', () => {
    const r = computeLineupSwaps(pool, base.filter(e => e.cardName !== 'Command and Conquer'));
    expect(r.changes).toEqual([
      { talisharId: 'command_and_conquer_red', name: 'Command and Conquer', pitch: 1, from: 3, to: 0 },
    ]);
  });
});
