/**
 * Integration tests for the facet content-manager service. Runs against local
 * Postgres. Uses throwaway tag definitions (valid slugs prefixed zzz-) so it
 * never disturbs the seeded vocabulary or curated assignments.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { PostgresFacetService } from './PostgresFacetService';
import { db } from '@/lib/postgres/db';
import { cards, cardFacetTags, facetTagDefinitions } from '@/lib/postgres/schema';

const service = new PostgresFacetService();
const TAG_A = 'zzz-test-facet-a';
const TAG_B = 'zzz-test-facet-b';
const TEST_TAGS = [TAG_A, TAG_B];

// Global, crash-proof cleanup: remove every test-tag assignment, strip them from
// the projection, then delete the defs (FK requires assignments gone first).
async function cleanup() {
  await db.delete(cardFacetTags).where(inArray(cardFacetTags.tag, TEST_TAGS));
  await db
    .update(cards)
    .set({ facetTags: sql`array_remove(array_remove(${cards.facetTags}, ${TAG_A}), ${TAG_B})` })
    .where(sql`${cards.facetTags} && ARRAY[${TAG_A}, ${TAG_B}]::text[]`);
  await db.delete(facetTagDefinitions).where(inArray(facetTagDefinitions.id, TEST_TAGS));
}

describe('PostgresFacetService — definitions', () => {
  afterEach(cleanup);

  it('lists the seeded vocabulary', async () => {
    const res = await service.listTagDefinitions();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.length).toBeGreaterThanOrEqual(26);
    expect(res.data.find((t) => t.id === 'combo-enabler')).toBeTruthy();
  });

  it('creates a new tag definition', async () => {
    const res = await service.createTagDefinition({ id: TAG_A, dim: 'mechanical', label: 'Test', def: 'x' });
    expect(res.success).toBe(true);
    const list = await service.listTagDefinitions();
    expect(list.success && list.data.some((t) => t.id === TAG_A)).toBe(true);
  });

  it('rejects an invalid slug id', async () => {
    const res = await service.createTagDefinition({ id: 'Not A Slug!', dim: 'mechanical', label: 'x' });
    expect(res.success).toBe(false);
  });

  it('reports usage counts with a count field per tag', async () => {
    const res = await service.getTagUsageCounts();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.length).toBeGreaterThanOrEqual(26);
    expect(res.data.every((t) => typeof t.cardCount === 'number')).toBe(true);
  });
});

describe('PostgresFacetService — delete guard', () => {
  let cardId: string;

  beforeAll(async () => {
    const [row] = await db.select({ id: cards.cardUniqueId }).from(cards).limit(1);
    cardId = row.id;
  });
  beforeEach(async () => {
    await service.createTagDefinition({ id: TAG_A, dim: 'mechanical', label: 'Test' });
  });
  afterEach(cleanup);

  it('refuses to delete a tag that is assigned', async () => {
    const add = await service.addCardFacetTag(cardId, TAG_A);
    expect(add.success).toBe(true);
    const res = await service.deleteTagDefinition(TAG_A);
    expect(res.success).toBe(false);
  });

  it('deletes a tag that is unassigned', async () => {
    const res = await service.deleteTagDefinition(TAG_A);
    expect(res.success).toBe(true);
    const list = await service.listTagDefinitions();
    expect(list.success && list.data.some((t) => t.id === TAG_A)).toBe(false);
  });
});

describe('PostgresFacetService — add/remove fan-out + safe projection', () => {
  let displayName: string;
  let variantIds: string[];

  beforeAll(async () => {
    // a multi-printing card so we can prove tags fan out to every variant
    const [row] = await db.select({ name: cards.displayName }).from(cards).where(eq(cards.displayName, 'Aether Dart')).limit(1);
    displayName = row.name;
    const rows = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, displayName));
    variantIds = rows.map((r) => r.id);
  });
  beforeEach(async () => {
    await service.createTagDefinition({ id: TAG_A, dim: 'mechanical', label: 'A' });
    await service.createTagDefinition({ id: TAG_B, dim: 'mechanical', label: 'B' });
  });
  afterEach(cleanup);

  it('adds a tag to every same-name variant and projects it', async () => {
    expect(variantIds.length).toBeGreaterThan(1);
    const res = await service.addCardFacetTag(variantIds[0], TAG_A);
    expect(res.success && res.data.applied).toBe(variantIds.length);

    const rows = await db.select({ ft: cards.facetTags }).from(cards).where(eq(cards.displayName, displayName));
    for (const r of rows) expect(r.ft).toContain(TAG_A);
  });

  it('removes only the named tag, leaving other tags intact', async () => {
    await service.addCardFacetTag(variantIds[0], TAG_A);
    await service.addCardFacetTag(variantIds[0], TAG_B);
    await service.removeCardFacetTag(variantIds[0], TAG_A);

    const rows = await db.select({ ft: cards.facetTags }).from(cards).where(eq(cards.displayName, displayName));
    for (const r of rows) {
      expect(r.ft).not.toContain(TAG_A);
      expect(r.ft).toContain(TAG_B);
    }
  });

  it('never mutates any cards column other than facet_tags', async () => {
    const cols = { name: cards.name, text: cards.text, power: cards.power, ccLegal: cards.ccLegal };
    const before = await db.select(cols).from(cards).where(eq(cards.cardUniqueId, variantIds[0]));
    await service.addCardFacetTag(variantIds[0], TAG_A);
    await service.removeCardFacetTag(variantIds[0], TAG_A);
    const after = await db.select(cols).from(cards).where(eq(cards.cardUniqueId, variantIds[0]));
    expect(after).toEqual(before);
  });

  it('rejects assigning a tag not in the vocabulary', async () => {
    const res = await service.addCardFacetTag(variantIds[0], 'zzz-nonexistent-tag');
    expect(res.success).toBe(false);
  });
});

describe('PostgresFacetService — strategy notes', () => {
  let cardId: string;
  let siblingId: string;

  beforeAll(async () => {
    // Two pitch variants of the same name — notes must NOT fan out (unlike tags:
    // red and blue of a card can play different roles, so prose is per-variant).
    const rows = await db
      .select({ id: cards.cardUniqueId })
      .from(cards)
      .where(eq(cards.displayName, 'Aether Dart'))
      .orderBy(cards.cardUniqueId);
    cardId = rows[0].id;
    siblingId = rows[1].id;
  });

  afterEach(async () => {
    await db.execute(sql`UPDATE cards SET strategy_notes = NULL WHERE card_unique_id IN (${cardId}, ${siblingId})`);
  });

  it('sets and reads back strategy notes for one card', async () => {
    const set = await service.setStrategyNotes(cardId, 'Test note: excellent vs. daggers.');
    expect(set.success).toBe(true);
    const get = await service.getStrategyNotes(cardId);
    expect(get.success && get.data.notes).toBe('Test note: excellent vs. daggers.');
  });

  it('does NOT fan out to same-name pitch variants', async () => {
    await service.setStrategyNotes(cardId, 'red-specific note');
    const sibling = await service.getStrategyNotes(siblingId);
    expect(sibling.success && sibling.data.notes).toBe(null);
  });

  it('clears notes when set to null', async () => {
    await service.setStrategyNotes(cardId, 'temp');
    const res = await service.setStrategyNotes(cardId, null);
    expect(res.success).toBe(true);
    const get = await service.getStrategyNotes(cardId);
    expect(get.success && get.data.notes).toBe(null);
  });

  it('rejects an unknown card id', async () => {
    const res = await service.setStrategyNotes('zzz-no-such-card', 'x');
    expect(res.success).toBe(false);
  });

  it('never mutates any cards column other than strategy_notes', async () => {
    // ccLegal, NOT facetTags: the votes test file legitimately projects its own
    // tags onto this same fixture card in parallel, so a facetTags before/after
    // snapshot races. No parallel test writes name/text/power/ccLegal.
    const cols = { name: cards.name, text: cards.text, power: cards.power, ccLegal: cards.ccLegal };
    const before = await db.select(cols).from(cards).where(eq(cards.cardUniqueId, cardId));
    await service.setStrategyNotes(cardId, 'note');
    await service.setStrategyNotes(cardId, null);
    const after = await db.select(cols).from(cards).where(eq(cards.cardUniqueId, cardId));
    expect(after).toEqual(before);
  });
});
