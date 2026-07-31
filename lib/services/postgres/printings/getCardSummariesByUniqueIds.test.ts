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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/postgres/db';
import { cards, printings } from '@/lib/postgres/schema';
import { inArray } from 'drizzle-orm';
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

  it('never picks a Marvel representative when a non-Marvel printing exists', async () => {
    // Oysten, Heart of Gold: earliest set (sea) only has the Marvel (SEA263);
    // the regular rare is the later Gravy Bones armory printing (agb). The
    // earliest-set preference must not surface the chase Marvel as the face.
    const OYSTEN = 'fDMt9jWjpCQKJPQbfcpWg';
    const res = await service.getCardSummariesByUniqueIds([OYSTEN]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(1);
    const p = await service.searchPrintings(
      { printingIds: [res.data[0].representativePrintingId] },
      { limit: 1 },
    );
    expect(p.success).toBe(true);
    if (!p.success) return;
    expect(p.data.printings[0].rarity).not.toBe('v');
    expect(p.data.printings[0].set).toBe('agb');
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

  it('deprioritizes printing_id-keyed image_urls when a better-imaged printing exists', async () => {
    // Real-world hazard (tuffnut HER001 / kassai HER110): some rows still carry
    // an image_url keyed by their own printing_id — either a deleted Cloudflare
    // image (dead link) or a deliberately-kept alt-art collision variant.
    // Neither is the portrait a representative lookup should pick when a
    // deterministically-keyed image exists on another printing, even one from a
    // LATER set.
    const token = `zzrepimg${crypto.randomUUID().slice(0, 8)}`;
    const cardId = `${token}-card`;
    const earlyStaleId = `${token}-pr-early`;
    const lateGoodId = `${token}-pr-late`;
    const CF = 'https://imagedelivery.net/test';
    try {
      await db.insert(cards).values([
        { cardUniqueId: cardId, name: `${token} hero`, displayName: `${token} hero`, types: ['hero'] },
      ]);
      await db.insert(printings).values([
        // Earliest set (her, release_order 80) but image keyed by printing_id
        { printingId: earlyStaleId, cardUniqueId: cardId, set: 'her', edition: 'n', foiling: 'r', rarity: 'p', imageUrl: `${CF}/${earlyStaleId}/public` },
        // Later set (sup) with a deterministic print-code image id
        { printingId: lateGoodId, cardUniqueId: cardId, set: 'sup', edition: 'n', foiling: 's', rarity: 'c', imageUrl: `${CF}/SUP901/public` },
      ]);

      const res = await service.getCardSummariesByUniqueIds([cardId]);
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.data).toHaveLength(1);
      expect(res.data[0].representativePrintingId).toBe(lateGoodId);
      expect(res.data[0].representativeImageUrl).toBe(`${CF}/SUP901/public`);
    } finally {
      await db.delete(printings).where(inArray(printings.printingId, [earlyStaleId, lateGoodId]));
      await db.delete(cards).where(inArray(cards.cardUniqueId, [cardId]));
    }
  });

  it('still returns a printing_id-keyed image when it is the only one (fallback, not exclusion)', async () => {
    const token = `zzreponly${crypto.randomUUID().slice(0, 8)}`;
    const cardId = `${token}-card`;
    const onlyId = `${token}-pr-only`;
    const url = `https://imagedelivery.net/test/${onlyId}/public`;
    try {
      await db.insert(cards).values([
        { cardUniqueId: cardId, name: `${token} hero`, displayName: `${token} hero`, types: ['hero'] },
      ]);
      await db.insert(printings).values([
        { printingId: onlyId, cardUniqueId: cardId, set: 'her', edition: 'n', foiling: 'r', rarity: 'p', imageUrl: url },
      ]);

      const res = await service.getCardSummariesByUniqueIds([cardId]);
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.data[0].representativePrintingId).toBe(onlyId);
      expect(res.data[0].representativeImageUrl).toBe(url);
    } finally {
      await db.delete(printings).where(inArray(printings.printingId, [onlyId]));
      await db.delete(cards).where(inArray(cards.cardUniqueId, [cardId]));
    }
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
