// lib/utils/matchup-breakdown.test.ts
//
// The breakdown chip renders: total · red · yellow · blue · [other*], where the
// total is the LIBRARY (main deck) — the number the 60+ / Silver Age 40 limit
// governs. Equipment & weapons are counted separately (their own chip), and the
// hero is counted nowhere: it is never rendered as a pip and can never be
// sideboarded (its tiles are non-interactive).

import { describe, it, expect } from 'vitest';
import { computeMatchupBreakdown, computeSwapDeltas } from './matchup-breakdown';

const printing = (name: string, pitch: number | null, types: string[], quantity = 1) => ({
  printingId: `p-${name}-${pitch ?? 0}`,
  quantity,
  printingDetails: { name, pitch: pitch ?? undefined, types },
});

const DECK = {
  hero: [printing('Maxx Nitro', null, ['mechanologist', 'hero'])],
  equipment: [
    printing('Teklo Foundry Heart', null, ['mechanologist', 'equipment', 'chest']),
    printing('Breaker Helm Protos', null, ['mechanologist', 'equipment', 'head']),
  ],
  maindeck: [
    printing('Command and Conquer', 1, ['generic', 'action', 'attack'], 3),
    printing('Fate Foreseen', 2, ['generic', 'defense reaction'], 2),
    printing('Scrap Hopper', 3, ['mechanologist', 'action', 'attack'], 3),
  ],
  inventory: [printing('Sink Below', 1, ['generic', 'defense reaction'], 2)],
};

describe('computeMatchupBreakdown', () => {
  it('makes the total the sum of the pips the chip renders', () => {
    const { main } = computeMatchupBreakdown(DECK);
    expect(main.red).toBe(3);
    expect(main.yellow).toBe(2);
    expect(main.blue).toBe(3);
    expect(main.other).toBe(0);
    expect(main.total).toBe(main.red + main.yellow + main.blue + main.other);
  });

  it('counts equipment and weapons separately from the library total', () => {
    const { main } = computeMatchupBreakdown(DECK);
    expect(main.equipment).toBe(2);
    expect(main.total).toBe(8);        // library only
    expect(main.library).toBe(8);      // total IS the library
  });

  it('leaves the hero out of every total but still counts it', () => {
    const { main } = computeMatchupBreakdown(DECK);
    expect(main.hero).toBe(1);
    expect(main.total).toBe(8);
    expect(main.library).toBe(8);
  });

  it('counts an unpitched library card in other, and in both library and total', () => {
    const deck = { maindeck: [printing('Codex of Frailty', null, ['generic', 'action'], 2)] };
    const { main } = computeMatchupBreakdown(deck);
    expect(main.other).toBe(2);
    expect(main.library).toBe(2);
    expect(main.total).toBe(2);
  });

  describe('with sideboard swaps applied', () => {
    it('moves a library card from main to inventory and keeps both totals summing', () => {
      const { main, inv } = computeMatchupBreakdown(DECK, { out: ['command_and_conquer_red'] });
      expect(main.red).toBe(2);
      expect(main.total).toBe(7);
      expect(main.total).toBe(main.red + main.yellow + main.blue + main.other);
      expect(inv.red).toBe(3);   // 2 in inventory + the one benched
      expect(inv.total).toBe(inv.red + inv.yellow + inv.blue + inv.other);
    });

    it('moves an equipment swap through the equipment bucket, not the library', () => {
      const { main, inv } = computeMatchupBreakdown(DECK, { out: ['teklo_foundry_heart'] });
      expect(main.equipment).toBe(1);
      expect(main.library).toBe(8);
      expect(main.total).toBe(8);   // benching equipment does not shrink the library
      expect(inv.equipment).toBe(1);
    });

    it('nets out to the original when a card goes out and comes back in', () => {
      const base = computeMatchupBreakdown(DECK);
      const swapped = computeMatchupBreakdown(DECK, { out: ['scrap_hopper_blue'], in: ['scrap_hopper_blue'] });
      expect(swapped.main.total).toBe(base.main.total);
      expect(swapped.main.blue).toBe(base.main.blue);
    });
  });
});

// The stats bar shows "before → after" with −out/+in badges. Those have to be
// counted on the same basis as the number they modify, or the arithmetic stops
// reconciling the moment a plan benches equipment as well as library cards.
describe('computeSwapDeltas', () => {
  const cards = [
    { section: 'red' as const, originalDeckCount: 3, deckCount: 1 },        // 2 library out
    { section: 'blue' as const, originalDeckCount: 2, deckCount: 3 },       // 1 library in
    { section: 'equipment' as const, originalDeckCount: 3, deckCount: 1 },  // 2 equipment out
    { section: 'weapon' as const, originalDeckCount: 1, deckCount: 1 },     // untouched
    { section: 'hero' as const, originalDeckCount: 1, deckCount: 1 },       // never swappable
  ];

  it('counts library swaps apart from equipment swaps', () => {
    const d = computeSwapDeltas(cards);
    expect(d.library).toEqual({ out: 2, in: 1, before: 5, after: 4 });
    expect(d.equipment).toEqual({ out: 2, in: 0, before: 4, after: 2 });
  });

  it('makes before − out + in land exactly on after, per basis', () => {
    const d = computeSwapDeltas(cards);
    expect(d.library.before - d.library.out + d.library.in).toBe(d.library.after);
    expect(d.equipment.before - d.equipment.out + d.equipment.in).toBe(d.equipment.after);
  });

  it('ignores the hero on both bases', () => {
    const d = computeSwapDeltas([{ section: 'hero' as const, originalDeckCount: 1, deckCount: 0 }]);
    expect(d.library).toEqual({ out: 0, in: 0, before: 0, after: 0 });
    expect(d.equipment).toEqual({ out: 0, in: 0, before: 0, after: 0 });
  });

  it('reports no changes for an untouched plan', () => {
    const d = computeSwapDeltas([{ section: 'red' as const, originalDeckCount: 3, deckCount: 3 }]);
    expect(d.library.out + d.library.in + d.equipment.out + d.equipment.in).toBe(0);
  });
});
