/**
 * Integration tests for PostgresPrintingsService.getCardSummariesByUniqueIds.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Purpose: given an arbitrary set of card_unique_ids (e.g. the banned-cards
 * registry, which is keyed by CARD not printing), return ONE representative
 * printing per card in a single query. Replaces the old pattern of calling
 * searchPrintings with a row-count limit, which over-fetched every printing
 * of every card and truncated late-sorting cards out of the result entirely.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService.getCardSummariesByUniqueIds', () => {
  let sampleIds: string[] = [];

  beforeAll(async () => {
    // Harvest a real set of distinct card_unique_ids to look up. Pull a class
    // with a large pool so we exercise many cards with many printings each.
    const pool = await service.searchCardsForHero({ heroClasses: ['guardian'] });
    if (!pool.success) throw new Error('failed to load sample pool');
    sampleIds = pool.data.map((c) => c.cardUniqueId);
  });

  it('returns exactly one row per requested cardUniqueId', async () => {
    // Take 50 cards — enough that the OLD limit-based approach would truncate.
    const ids = sampleIds.slice(0, 50);
    const result = await service.getCardSummariesByUniqueIds(ids);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Every requested id must be present, with no duplicates.
    const returnedIds = result.data.map((c) => c.cardUniqueId);
    expect(new Set(returnedIds).size).toBe(returnedIds.length);
    expect(new Set(returnedIds)).toEqual(new Set(ids));
  });

  it('does not truncate when cards have many printings each', async () => {
    // Regression for the banned-cards blank-image bug: the requested cards each
    // have several printings, so a naive "limit = N*5 printings" approach left
    // late-sorting cards unresolved. Here we assert full coverage.
    const ids = sampleIds.slice(0, Math.min(80, sampleIds.length));
    const result = await service.getCardSummariesByUniqueIds(ids);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.length).toBe(ids.length);
  });

  it('populates name and a representative printing for display', async () => {
    const ids = sampleIds.slice(0, 5);
    const result = await service.getCardSummariesByUniqueIds(ids);

    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const card of result.data) {
      expect(card.cardUniqueId).toBeTruthy();
      expect(typeof card.name).toBe('string');
      expect(card.name.length).toBeGreaterThan(0);
      expect(typeof card.representativePrintingId).toBe('string');
      expect(card.representativePrintingId.length).toBeGreaterThan(0);
    }
  });

  it('picks the EARLIEST printing as the representative (Rhinar → WTR)', async () => {
    const RHINAR = 'wr9wBtTWwRrPrdhCRHCdN'; // rhinar, reckless rampage (earliest set: wtr)
    const res = await service.getCardSummariesByUniqueIds([RHINAR]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(1);
    // Resolve the chosen representative printing's set — must be the original (WTR).
    const p = await service.searchPrintings(
      { printingIds: [res.data[0].representativePrintingId] },
      { limit: 1 },
    );
    expect(p.success).toBe(true);
    if (!p.success) return;
    expect(p.data.printings[0].set).toBe('wtr');
  });

  it('includes card-level health and intelligence (for hero tiles)', async () => {
    const RHINAR = 'wr9wBtTWwRrPrdhCRHCdN';
    const res = await service.getCardSummariesByUniqueIds([RHINAR]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0].health ?? 0).toBeGreaterThan(0);
    expect(res.data[0].intelligence ?? 0).toBeGreaterThan(0);
  });

  it('returns an empty array for an empty input (no DB round trip needed)', async () => {
    const result = await service.getCardSummariesByUniqueIds([]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });

  it('silently skips unknown ids rather than erroring', async () => {
    const ids = [sampleIds[0], 'totally-not-a-real-card-id'];
    const result = await service.getCardSummariesByUniqueIds(ids);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const returnedIds = result.data.map((c) => c.cardUniqueId);
    expect(returnedIds).toContain(sampleIds[0]);
    expect(returnedIds).not.toContain('totally-not-a-real-card-id');
  });
});
