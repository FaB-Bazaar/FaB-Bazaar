// lib/services/postgres/scan/PostgresScanService.test.ts
// Integration tests against local Postgres (migration 0109: printing_image_hashes).
// Uses REAL printing ids (FK) but snapshots + restores any hash rows it touches,
// so it is safe to run against a DB that already holds a built index.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { printings, printingImageHashes } from '@/lib/postgres/schema';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { PostgresScanService } from './PostgresScanService';

const service = new PostgresScanService();

// Two foilings of ONE card (same card_unique_id) + one printing of another card.
let sameCardA: string, sameCardB: string, otherCard: string, sameCardUniqueId: string;
let snapshot: (typeof printingImageHashes.$inferSelect)[] = [];

const ZERO = '0000000000000000';
const ONES = 'ffffffffffffffff';

beforeAll(async () => {
  const pair = await db.execute(sql`
    SELECT p.card_unique_id, array_agg(p.printing_id ORDER BY p.printing_id) AS ids
    FROM printings p
    WHERE p.language = 'en' AND p.image_url IS NOT NULL AND p.set = 'wtr'
    GROUP BY p.card_unique_id HAVING count(*) >= 2
    ORDER BY p.card_unique_id ASC LIMIT 1`);
  const row = (pair as any).rows?.[0] ?? (pair as any)[0];
  sameCardUniqueId = row.card_unique_id;
  [sameCardA, sameCardB] = row.ids;
  const other = await db.select({ id: printings.printingId }).from(printings)
    .where(and(eq(printings.language, 'en'), isNotNull(printings.imageUrl), sql`${printings.cardUniqueId} <> ${sameCardUniqueId}`))
    .orderBy(sql`${printings.printingId} DESC`).limit(1);
  otherCard = other[0].id;
  snapshot = await db.select().from(printingImageHashes).where(inArray(printingImageHashes.printingId, [sameCardA, sameCardB, otherCard]));
});

afterEach(async () => {
  await db.delete(printingImageHashes).where(inArray(printingImageHashes.printingId, [sameCardA, sameCardB, otherCard]));
  if (snapshot.length) await db.insert(printingImageHashes).values(snapshot);
  service.clearIndexCache();
});

describe('PostgresScanService', () => {
  it('upsertHashes inserts rows that listHashIndex returns with their card id', async () => {
    const res = await service.upsertHashes([
      { printingId: otherCard, phash: ONES, dhash: ONES, imageUrl: 'https://example.test/x' },
    ]);
    expect(res.success).toBe(true);
    const idx = await service.listHashIndex();
    expect(idx.success).toBe(true);
    if (!idx.success) return;
    const row = idx.data.find(r => r.printingId === otherCard);
    expect(row).toMatchObject({ printingId: otherCard, phash: ONES, dhash: ONES });
    expect(row?.cardUniqueId).toBeTruthy();
  });

  it('upsertHashes is idempotent per printing and overwrites the hash', async () => {
    await service.upsertHashes([{ printingId: otherCard, phash: ONES, dhash: ONES, imageUrl: 'u1' }]);
    const res = await service.upsertHashes([{ printingId: otherCard, phash: ZERO, dhash: ZERO, imageUrl: 'u2' }]);
    expect(res).toEqual({ success: true, data: { upserted: 1 } });
    const rows = await db.select().from(printingImageHashes).where(eq(printingImageHashes.printingId, otherCard));
    expect(rows).toHaveLength(1);
    expect(rows[0].phash).toBe(ZERO);
    expect(rows[0].imageUrl).toBe('u2');
  });

  it('identify ranks the exact-hash card first at distance 0 and groups its printings under one card', async () => {
    await service.upsertHashes([
      { printingId: sameCardA, phash: ZERO, dhash: ZERO, imageUrl: 'a' },
      { printingId: sameCardB, phash: ZERO, dhash: ZERO, imageUrl: 'b' },
      { printingId: otherCard, phash: ONES, dhash: ONES, imageUrl: 'c' },
    ]);
    service.clearIndexCache();
    const res = await service.identify({ phash: ZERO, dhash: ZERO }, { limit: 3 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    const best = res.data.candidates[0];
    expect(best.distance).toBe(0);
    expect(best.cards.map(c => c.cardUniqueId)).toContain(sameCardUniqueId);
    const card = best.cards.find(c => c.cardUniqueId === sameCardUniqueId)!;
    // every printing of the card is offered (the user picks foiling/edition/
    // language), with the hash-matched ones first and unmatched ones at null
    expect(card.printings.slice(0, 2).map(p => p.printingId).sort()).toEqual([sameCardA, sameCardB].sort());
    expect(card.printings.slice(0, 2).every(p => p.distance === 0)).toBe(true);
    expect(card.printings.slice(2).every(p => p.distance === null)).toBe(true);
    expect(card.printings[0]).toMatchObject({ collectorNumber: expect.any(String), set: 'wtr' });
    expect(typeof best.name).toBe('string');
    // the unrelated card is not in front of it
    const otherIdx = res.data.candidates.findIndex(c => c.cards.some(cc => cc.printings.some(p => p.printingId === otherCard)));
    expect(otherIdx === -1 || otherIdx > 0).toBe(true);
  });

  it('identify orders pitch siblings by the hint when one is given', async () => {
    // Synthetic: use the ordering helper directly on a fabricated group.
    const { orderCardsByPitchHint } = await import('./PostgresScanService');
    const cards = [
      { cardUniqueId: 'b', pitch: 3, distance: 5 },
      { cardUniqueId: 'y', pitch: 2, distance: 5 },
      { cardUniqueId: 'r', pitch: 1, distance: 5 },
    ];
    expect(orderCardsByPitchHint(cards, 'yellow').map(c => c.cardUniqueId)).toEqual(['y', 'r', 'b']);
    expect(orderCardsByPitchHint(cards, null).map(c => c.cardUniqueId)).toEqual(['r', 'y', 'b']);
  });
});
