/**
 * Integration tests for card facet tags: the `facetTags` search filter and the
 * get/set service methods. Runs against local Postgres.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';
import { db } from '@/lib/postgres/db';
import { cards, cardFacetTags } from '@/lib/postgres/schema';

const service = new PostgresPrintingsService();
const SENTINEL = '__facet_test__';

describe('PostgresPrintingsService — facetTags filter', () => {
  let cardId: string;

  beforeAll(async () => {
    const [row] = await db.select({ id: cards.cardUniqueId })
      .from(cards).where(eq(cards.displayName, 'Flood of Force')).limit(1);
    cardId = row.id;
    await db.update(cards).set({ facetTags: [SENTINEL] }).where(eq(cards.cardUniqueId, cardId));
  });

  afterAll(async () => {
    await db.update(cards).set({ facetTags: [] }).where(eq(cards.cardUniqueId, cardId));
  });

  it('filters cards by facet_tags array overlap', async () => {
    const res = await service.searchPrintings({ facetTags: [SENTINEL] }, { limit: 50 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    expect(res.data.printings.every((p) => p.card_unique_id === cardId)).toBe(true);
  });
});

describe('PostgresPrintingsService — get/set card facet tags', () => {
  let cardId: string;
  let displayName: string;

  beforeAll(async () => {
    // A multi-printing card so we can verify tags apply to all same-name variants.
    const [row] = await db.select({ id: cards.cardUniqueId, name: cards.displayName })
      .from(cards).where(eq(cards.displayName, 'Hundred Winds')).limit(1);
    cardId = row.id;
    displayName = row.name;
  });

  beforeEach(async () => {
    // clean slate for this card's name
    const ids = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, displayName));
    for (const { id } of ids) {
      await db.delete(cardFacetTags).where(eq(cardFacetTags.cardUniqueId, id));
      await db.update(cards).set({ facetTags: [] }).where(eq(cards.cardUniqueId, id));
    }
  });

  afterAll(async () => {
    const ids = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, displayName));
    for (const { id } of ids) {
      await db.delete(cardFacetTags).where(eq(cardFacetTags.cardUniqueId, id));
      await db.update(cards).set({ facetTags: [] }).where(eq(cards.cardUniqueId, id));
    }
  });

  it('setCardFacetTags writes the table, projects to cards.facet_tags, and applies to all same-name variants', async () => {
    const res = await service.setCardFacetTags(cardId, ['scaling', 'chain-extender']);
    expect(res.success).toBe(true);

    // every card_unique_id sharing the name has the projected tags
    const rows = await db.select({ ft: cards.facetTags }).from(cards).where(eq(cards.displayName, displayName));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect([...r.ft].sort()).toEqual(['chain-extender', 'scaling']);
    }
  });

  it('getCardFacetTags returns the current tags', async () => {
    await service.setCardFacetTags(cardId, ['beats-fatigue']);
    const res = await service.getCardFacetTags(cardId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual(['beats-fatigue']);
  });

  it('rejects tags not in the card-facets vocabulary', async () => {
    const res = await service.setCardFacetTags(cardId, ['not-a-real-tag']);
    expect(res.success).toBe(false);
  });

  it('setCardFacetTags replaces (does not append) prior tags', async () => {
    await service.setCardFacetTags(cardId, ['scaling']);
    await service.setCardFacetTags(cardId, ['recursion']);
    const res = await service.getCardFacetTags(cardId);
    expect(res.success && res.data).toEqual(['recursion']);
  });
});
