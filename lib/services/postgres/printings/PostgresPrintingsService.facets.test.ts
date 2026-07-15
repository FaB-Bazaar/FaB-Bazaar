/**
 * Integration tests for card facet tags: the `facetTags` search filter and the
 * get/set service methods. Runs against local Postgres.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';
import { db } from '@/lib/postgres/db';
import { cards, cardFacetTags, cardFacetTagVotes, facetTagDefinitions, users } from '@/lib/postgres/schema';

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

  it('returns the card facet_tags in the search projection (card→tags visibility)', async () => {
    const res = await service.searchPrintings({ facetTags: [SENTINEL] }, { limit: 5 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings[0].facet_tags).toContain(SENTINEL);
  });
});

describe('PostgresPrintingsService — facetTags Any/All match mode', () => {
  // A card carrying BOTH sentinel tags, used to distinguish overlap (ANY) from
  // contains (ALL). Sentinels are unique so parallel test files can't collide.
  const S1 = '__facet_all_a__';
  const S2 = '__facet_all_b__';
  const S3 = '__facet_all_c__';
  let cardId: string;

  beforeAll(async () => {
    const [row] = await db.select({ id: cards.cardUniqueId })
      .from(cards).where(eq(cards.displayName, 'Break Tide')).limit(1);
    cardId = row.id;
    await db.update(cards).set({ facetTags: [S1, S2] }).where(eq(cards.cardUniqueId, cardId));
  });

  afterAll(async () => {
    await db.update(cards).set({ facetTags: [] }).where(eq(cards.cardUniqueId, cardId));
  });

  it("ALL mode matches a card that has EVERY selected tag", async () => {
    const res = await service.searchPrintings({ facetTags: [S1, S2], facetTagsMode: 'all' }, { limit: 50 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.some((p) => p.card_unique_id === cardId)).toBe(true);
  });

  it("ALL mode excludes a card missing one of the selected tags", async () => {
    const res = await service.searchPrintings({ facetTags: [S1, S3], facetTagsMode: 'all' }, { limit: 50 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.some((p) => p.card_unique_id === cardId)).toBe(false);
  });

  it("ANY mode (default) still matches on a single overlapping tag", async () => {
    const res = await service.searchPrintings({ facetTags: [S1, S3], facetTagsMode: 'any' }, { limit: 50 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.some((p) => p.card_unique_id === cardId)).toBe(true);
  });
});

describe('PostgresPrintingsService — facetTagsViewerId (personal truth)', () => {
  // A user's OWN votes count as live for THEM, even below the 2-vote community
  // threshold. Sub-threshold votes exist only in card_facet_tag_votes (never in
  // the cards.facet_tags projection), so these rows are inserted directly.
  const T_MINE = 'zzz-viewer-mine';
  const T_LIVE = 'zzz-viewer-live';
  let cardId: string;
  let me: string;
  let stranger: string;

  beforeAll(async () => {
    // Dynamic fixture: an untagged card no other facet test file writes to
    // (vitest runs files in parallel against the same DB).
    // ORDER BY ASC — the summary test's dynamic picker takes the DESC end, so
    // two parallel files can never land on the same card (this one gets writes).
    const picked = await db.execute(sql`
      SELECT card_unique_id AS id FROM cards c
      WHERE facet_tags = '{}'
        AND display_name NOT IN ('Sink Below', 'Aether Dart', 'Absorb in Aether', 'Hundred Winds', 'Flood of Force', 'Break Tide')
        AND NOT EXISTS (SELECT 1 FROM card_facet_tag_votes v WHERE v.card_unique_id = c.card_unique_id)
      ORDER BY card_unique_id ASC
      LIMIT 1
    `);
    cardId = ((picked as unknown as { rows: any[] }).rows ?? (picked as unknown as any[]))[0].id;

    me = crypto.randomUUID();
    stranger = crypto.randomUUID();
    await db.insert(users).values([
      { id: me, username: `zzz_viewer_${me.slice(0, 8)}` },
      { id: stranger, username: `zzz_viewer_${stranger.slice(0, 8)}` },
    ]);
    await db.insert(facetTagDefinitions).values([
      { id: T_MINE, dim: 'mechanical', label: T_MINE, def: '' },
      { id: T_LIVE, dim: 'mechanical', label: T_LIVE, def: '' },
    ]);
    // My single sub-threshold vote (votes table only, NOT projected)…
    await db.insert(cardFacetTagVotes).values({ cardUniqueId: cardId, tag: T_MINE, userId: me });
    // …and a globally-live tag on the same card (projection only).
    await db.update(cards).set({ facetTags: [T_LIVE] }).where(eq(cards.cardUniqueId, cardId));
  });

  afterAll(async () => {
    await db.delete(cardFacetTagVotes).where(inArray(cardFacetTagVotes.tag, [T_MINE, T_LIVE]));
    await db.update(cards).set({ facetTags: [] }).where(eq(cards.cardUniqueId, cardId));
    await db.delete(facetTagDefinitions).where(inArray(facetTagDefinitions.id, [T_MINE, T_LIVE]));
    await db.delete(users).where(inArray(users.id, [me, stranger]));
  });

  const found = async (filters: any) => {
    const res = await service.searchPrintings(filters, { limit: 50 });
    expect(res.success).toBe(true);
    return res.success && res.data.printings.some((p) => p.card_unique_id === cardId);
  };

  it('my sub-threshold vote matches MY search (any mode)', async () => {
    expect(await found({ facetTags: [T_MINE], facetTagsViewerId: me })).toBe(true);
  });

  it('does NOT match anonymous or other users', async () => {
    expect(await found({ facetTags: [T_MINE] })).toBe(false);
    expect(await found({ facetTags: [T_MINE], facetTagsViewerId: stranger })).toBe(false);
  });

  it('ALL mode merges my votes with the live projection', async () => {
    // live tag from the projection + my sub-threshold vote → ALL matches for me only
    expect(await found({ facetTags: [T_LIVE, T_MINE], facetTagsMode: 'all', facetTagsViewerId: me })).toBe(true);
    expect(await found({ facetTags: [T_LIVE, T_MINE], facetTagsMode: 'all' })).toBe(false);
    expect(await found({ facetTags: [T_LIVE, T_MINE], facetTagsMode: 'all', facetTagsViewerId: stranger })).toBe(false);
  });

  it('a viewer id alone never widens results beyond the requested tags', async () => {
    // Searching for a tag nobody assigned still returns nothing for me.
    expect(await found({ facetTags: ['zzz-viewer-unrelated'], facetTagsViewerId: me })).toBe(false);
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
