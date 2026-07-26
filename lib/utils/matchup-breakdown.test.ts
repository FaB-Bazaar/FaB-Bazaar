// lib/utils/matchup-breakdown.test.ts
//
// The breakdown chip renders: total · red · yellow · blue · [shield equipment] · [other*].
// The hero is never rendered and can never be sideboarded (its tiles are
// non-interactive), so it must not be inside `total` — otherwise the chip reads
// "Main · 66 · 25 12 23 ⛊5", which sums to 65 and looks like a counting bug.

import { describe, it, expect } from 'vitest';
import { computeMatchupBreakdown } from './matchup-breakdown';

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
  it('makes the total the sum of the parts the chip renders', () => {
    const { main } = computeMatchupBreakdown(DECK);
    expect(main.red).toBe(3);
    expect(main.yellow).toBe(2);
    expect(main.blue).toBe(3);
    expect(main.equipment).toBe(2);
    expect(main.other).toBe(0);
    expect(main.total).toBe(main.red + main.yellow + main.blue + main.other + main.equipment);
  });

  it('leaves the hero out of the total but still counts it', () => {
    const { main } = computeMatchupBreakdown(DECK);
    expect(main.hero).toBe(1);
    expect(main.total).toBe(10);   // 8 library + 2 equipment, hero excluded
  });

  it('keeps library free of equipment and hero — it is what the 60+/40 limit governs', () => {
    const { main } = computeMatchupBreakdown(DECK);
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
      expect(main.total).toBe(9);
      expect(main.total).toBe(main.red + main.yellow + main.blue + main.other + main.equipment);
      expect(inv.red).toBe(3);   // 2 in inventory + the one benched
      expect(inv.total).toBe(inv.red + inv.yellow + inv.blue + inv.other + inv.equipment);
    });

    it('moves an equipment swap through the equipment bucket, not the library', () => {
      const { main, inv } = computeMatchupBreakdown(DECK, { out: ['teklo_foundry_heart'] });
      expect(main.equipment).toBe(1);
      expect(main.library).toBe(8);
      expect(main.total).toBe(9);
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
