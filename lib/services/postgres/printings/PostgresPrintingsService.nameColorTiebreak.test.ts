/**
 * When a search returns several cards that share a name but differ by pitch
 * (e.g. "Sink Below" exists as red/yellow/blue — WTR215/216/217), players expect
 * them ordered red → yellow → blue, the canonical pitch order. Before this fix,
 * the name sort left same-named cards in an arbitrary order (grouped: Postgres
 * representative order; flat: fell through to the price tiebreak).
 *
 * Runs against local Postgres.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

// asc pitch order: red→yellow→blue→non-pitch (empties always last)
const COLOR_RANK_ASC: Record<string, number> = { red: 1, yellow: 2, blue: 3, '': 4 };
const nonDecreasing = (arr: number[]) => arr.every((v, i) => i === 0 || arr[i - 1] <= v);

describe('PostgresPrintingsService — name sort tiebreaks same-named cards by pitch', () => {
  for (const groupByCard of [false, true]) {
    it(`${groupByCard ? 'grouped' : 'flat'}: "Sink Below" orders red → yellow → blue`, async () => {
      const res = await service.searchPrintings(
        { name: 'sink below' },
        { limit: 50, searchMode: 'strict', sortBy: 'name', sortOrder: 'asc', groupByCard },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      const colors = res.data.printings.map((p) => p.color ?? '');
      // All three pitch variants must be present for this to be a meaningful test.
      expect(new Set(colors).size).toBeGreaterThanOrEqual(3);

      const ranks = colors.map((c) => COLOR_RANK_ASC[c] ?? 4);
      expect(nonDecreasing(ranks)).toBe(true);
    });
  }
});
