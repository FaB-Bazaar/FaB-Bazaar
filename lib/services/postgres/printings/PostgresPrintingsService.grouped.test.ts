/**
 * Integration tests for opt-in card-level grouping in searchPrintings
 * (options.groupByCard). Runs against local Postgres.
 *
 * The first test is a REGRESSION GUARD: the default (no groupByCard) path must
 * keep returning every printing of a card — the card-search dialog and other
 * collection-adding dialogs depend on that for their printing-selection step.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const CC = { name: 'command and conquer', languages: ['en'] };

describe('PostgresPrintingsService — grouped search (opt-in)', () => {
  it('FLAT default returns multiple printings per card (dialog dependency)', async () => {
    const res = await service.searchPrintings(CC, { limit: 100, searchMode: 'strict' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = res.data.printings.map((p) => p.card_unique_id);
    // Command and Conquer has many English printings; the same card_unique_id
    // must appear more than once so the dialog can list every printing.
    expect(ids.length).toBeGreaterThan(new Set(ids).size);
  });

  it('GROUPED returns exactly one row per card_unique_id', async () => {
    const res = await service.searchPrintings(CC, { limit: 100, searchMode: 'strict', groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = res.data.printings.map((p) => p.card_unique_id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate cards
  });

  it('GROUPED represents each card by its cheapest printing', async () => {
    const [grouped, flat] = await Promise.all([
      service.searchPrintings(CC, { limit: 100, searchMode: 'strict', groupByCard: true }),
      service.searchPrintings(CC, { limit: 300, searchMode: 'strict' }),
    ]);
    expect(grouped.success && flat.success).toBe(true);
    if (!grouped.success || !flat.success) return;

    const minByCard = new Map<string, number>();
    for (const p of flat.data.printings) {
      if (p.tcg_low == null) continue;
      const cur = minByCard.get(p.card_unique_id);
      if (cur === undefined || p.tcg_low < cur) minByCard.set(p.card_unique_id, p.tcg_low);
    }
    for (const g of grouped.data.printings) {
      const min = minByCard.get(g.card_unique_id);
      if (min !== undefined && g.tcg_low != null) {
        expect(g.tcg_low).toBeLessThanOrEqual(min + 1e-9);
      }
    }
  });

  it('GROUPED total counts distinct cards, not printings', async () => {
    const grouped = await service.searchPrintings(
      { classes: ['ninja'], rarities: ['c'], languages: ['en'] },
      { limit: 5, groupByCard: true },
    );
    const flat = await service.searchPrintings(
      { classes: ['ninja'], rarities: ['c'], languages: ['en'] },
      { limit: 5 },
    );
    expect(grouped.success && flat.success).toBe(true);
    if (!grouped.success || !flat.success) return;

    expect(grouped.data.total).toBeGreaterThan(0);
    // Far fewer distinct cards than total printings.
    expect(grouped.data.total).toBeLessThan(flat.data.total);
    expect(grouped.data.printings.length).toBeLessThanOrEqual(5);
  });
});
