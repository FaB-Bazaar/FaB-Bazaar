/**
 * Integration tests for the batch facet summary (tile tags on the public
 * card-facets page): per card, live projected tags ∪ community-voted tags with
 * counts. Runs against local Postgres. Own zzz- slugs + throwaway users only —
 * never a broad LIKE cleanup (parallel test files share the seeded vocabulary).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { PostgresFacetService } from './PostgresFacetService';
import { db } from '@/lib/postgres/db';
import {
  cards,
  users,
  cardFacetTags,
  cardFacetTagVotes,
  facetTagAudit,
  facetTagDefinitions,
} from '@/lib/postgres/schema';

const service = new PostgresFacetService();
const T_CURATOR = 'zzz-sum-curator';
const T_PENDING = 'zzz-sum-pending';
const T_LIVE = 'zzz-sum-live';
const OWN_SLUGS = [T_CURATOR, T_PENDING, T_LIVE];

let cardId: string;
let otherCardId: string;
let userA: string;
let userB: string;

beforeAll(async () => {
  // Fixture cards deliberately NOT shared with any other facet test file
  // (Aether Dart / Absorb in Aether / Hundred Winds / Flood of Force /
  // Break Tide are taken) — this file holds tags on its card for its whole
  // lifetime, and vitest runs files in parallel against the same DB.
  const rows = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, 'Sink Below'));
  cardId = rows[0].id;
  // The "no tags" card must GENUINELY have none — pick one dynamically (a named
  // card could gain curated tags in any DB refresh and break the assertion).
  // ORDER BY DESC — the printings viewer test's dynamic picker takes the ASC
  // end (and writes votes to its pick), so parallel files never collide.
  const other = await db.execute(sql`
    SELECT card_unique_id AS id FROM cards c
    WHERE facet_tags = '{}'
      -- every card any facet/printings test file writes to (parallel runs share the DB)
      AND display_name NOT IN ('Sink Below', 'Aether Dart', 'Absorb in Aether', 'Hundred Winds', 'Flood of Force', 'Break Tide')
      AND NOT EXISTS (SELECT 1 FROM card_facet_tag_votes v WHERE v.card_unique_id = c.card_unique_id)
    ORDER BY card_unique_id DESC
    LIMIT 1
  `);
  otherCardId = ((other as unknown as { rows: any[] }).rows ?? (other as unknown as any[]))[0].id;

  userA = crypto.randomUUID();
  userB = crypto.randomUUID();
  await db.insert(users).values([
    { id: userA, username: `zzz_sum_${userA.slice(0, 8)}` },
    { id: userB, username: `zzz_sum_${userB.slice(0, 8)}` },
  ]);

  for (const id of OWN_SLUGS) {
    await service.createTagDefinition({ id, dim: 'mechanical', label: id });
  }
  await service.addCardFacetTag(cardId, T_CURATOR); // curator: live, 0 votes
  await service.voteCardFacetTag(cardId, T_PENDING, userA); // 1 vote: pending
  await service.voteCardFacetTag(cardId, T_LIVE, userA); // 2 votes: live
  await service.voteCardFacetTag(cardId, T_LIVE, userB);
});

afterAll(async () => {
  await db.delete(cardFacetTagVotes).where(inArray(cardFacetTagVotes.tag, OWN_SLUGS));
  await db.delete(cardFacetTags).where(inArray(cardFacetTags.tag, OWN_SLUGS));
  await db.delete(facetTagAudit).where(inArray(facetTagAudit.tag, OWN_SLUGS));
  await db
    .update(cards)
    .set({ facetTags: sql`array_remove(array_remove(array_remove(${cards.facetTags}, ${T_CURATOR}), ${T_PENDING}), ${T_LIVE})` })
    .where(sql`${cards.facetTags} && ARRAY[${T_CURATOR}, ${T_PENDING}, ${T_LIVE}]::text[]`);
  await db.delete(facetTagDefinitions).where(inArray(facetTagDefinitions.id, OWN_SLUGS));
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

describe('PostgresFacetService — getFacetSummaryForCards', () => {
  it('returns live + pending tags with vote counts, keyed by card', async () => {
    const res = await service.getFacetSummaryForCards([cardId]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const tags = Object.fromEntries((res.data[cardId] ?? []).map((t) => [t.tag, t]));

    expect(tags[T_CURATOR]).toMatchObject({ votes: 0, live: true }); // curator: authoritative, no votes
    expect(tags[T_PENDING]).toMatchObject({ votes: 1, live: false }); // below threshold
    expect(tags[T_LIVE]).toMatchObject({ votes: 2, live: true }); // at threshold
  });

  it('omits cards that have no tags at all', async () => {
    const res = await service.getFacetSummaryForCards([otherCardId]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[otherCardId]).toBeUndefined();
  });

  it('marks the viewer\'s own votes with mine=true (personal truth display)', async () => {
    const res = await service.getFacetSummaryForCards([cardId], userA);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const tags = Object.fromEntries((res.data[cardId] ?? []).map((t) => [t.tag, t]));
    expect(tags[T_PENDING]?.mine).toBe(true); // userA's own sub-threshold vote
    expect(tags[T_CURATOR]?.mine).toBe(false); // curator tag — nobody's vote
  });

  it('reports mine=false for other viewers and anonymous callers', async () => {
    const anon = await service.getFacetSummaryForCards([cardId]);
    expect(anon.success && anon.data[cardId]?.every((t) => t.mine === false)).toBe(true);
  });

  it('handles several cards in one call and an empty input', async () => {
    const multi = await service.getFacetSummaryForCards([cardId, otherCardId]);
    expect(multi.success).toBe(true);
    if (!multi.success) return;
    expect(Object.keys(multi.data)).toContain(cardId);

    const empty = await service.getFacetSummaryForCards([]);
    expect(empty.success && Object.keys(empty.data).length).toBe(0);
  });
});
