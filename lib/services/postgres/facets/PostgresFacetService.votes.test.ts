/**
 * Integration tests for community facet VOTES (migration 0080). Runs against
 * local Postgres. A community tag enters the cards.facet_tags projection only at
 * >= 2 distinct voters; curator-assigned tags stay authoritative regardless.
 * Removing a tag = retracting your own vote. Uses throwaway tags (zzz-) and
 * throwaway users so it never disturbs seeded vocabulary or real accounts.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
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
const TAG_A = 'zzz-vote-facet-a';
const TAG_B = 'zzz-vote-facet-b';
const TEST_TAGS = [TAG_A, TAG_B];

let displayName: string;
let variantIds: string[];
let userA: string;
let userB: string;
let userC: string;

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `zzz_vote_${id.slice(0, 8)}` });
  return id;
}

beforeAll(async () => {
  // A multi-variant card so we can prove votes fan out to every variant.
  // 'Absorb in Aether', NOT 'Aether Dart': the base facets test file fans out
  // curator writes over Aether Dart's variants, and two files reprojecting the
  // same card concurrently is a lost-update race (stale read → last write wins).
  // Every facet test file must own a DISTINCT fixture card.
  const [row] = await db.select({ name: cards.displayName }).from(cards).where(eq(cards.displayName, 'Absorb in Aether')).limit(1);
  displayName = row.name;
  const rows = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, displayName));
  variantIds = rows.map((r) => r.id);
  userA = await makeUser();
  userB = await makeUser();
  userC = await makeUser();
});

beforeEach(async () => {
  await service.createTagDefinition({ id: TAG_A, dim: 'mechanical', label: 'A' });
  await service.createTagDefinition({ id: TAG_B, dim: 'mechanical', label: 'B' });
});

afterEach(async () => {
  await db.delete(cardFacetTagVotes).where(inArray(cardFacetTagVotes.tag, TEST_TAGS));
  await db.delete(cardFacetTags).where(inArray(cardFacetTags.tag, TEST_TAGS));
  await db.delete(facetTagAudit).where(inArray(facetTagAudit.tag, TEST_TAGS));
  await db
    .update(cards)
    .set({ facetTags: sql`array_remove(array_remove(${cards.facetTags}, ${TAG_A}), ${TAG_B})` })
    .where(sql`${cards.facetTags} && ARRAY[${TAG_A}, ${TAG_B}]::text[]`);
  await db.delete(facetTagDefinitions).where(inArray(facetTagDefinitions.id, TEST_TAGS));
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [userA, userB, userC]));
});

async function projectedTags(cardId: string): Promise<string[]> {
  const [r] = await db.select({ ft: cards.facetTags }).from(cards).where(eq(cards.cardUniqueId, cardId));
  return r?.ft ?? [];
}

describe('PostgresFacetService — community votes: threshold projection', () => {
  it('does NOT project a tag with a single vote (below the consensus threshold)', async () => {
    const res = await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    expect(res.success).toBe(true);
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('projects a tag once two distinct users vote it', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB);
    for (const id of variantIds) expect(await projectedTags(id)).toContain(TAG_A);
  });

  it('un-projects the tag when a voter retracts back below the threshold', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB);
    await service.unvoteCardFacetTag(variantIds[0], TAG_A, userB);
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('treats repeat votes from the same user as idempotent (count stays 1)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    const res = await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    expect(res.success && res.data.votes).toBe(1);
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });
});

describe('PostgresFacetService — community votes: curator authority', () => {
  it('keeps a curator-assigned tag projected even with zero community votes', async () => {
    await service.addCardFacetTag(variantIds[0], TAG_A); // curator, authoritative
    for (const id of variantIds) expect(await projectedTags(id)).toContain(TAG_A);
  });

  it('leaves a curator tag projected after a lone community voter retracts', async () => {
    await service.addCardFacetTag(variantIds[0], TAG_A); // curator
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA); // one community vote
    await service.unvoteCardFacetTag(variantIds[0], TAG_A, userA);
    for (const id of variantIds) expect(await projectedTags(id)).toContain(TAG_A);
  });
});

describe('PostgresFacetService — community votes: fan-out + read model', () => {
  it('fans a vote out to every same-name variant', async () => {
    expect(variantIds.length).toBeGreaterThan(1);
    const res = await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    expect(res.success && res.data.applied).toBe(variantIds.length);
    for (const id of variantIds) {
      const rows = await db.select().from(cardFacetTagVotes).where(
        sql`${cardFacetTagVotes.cardUniqueId} = ${id} AND ${cardFacetTagVotes.tag} = ${TAG_A} AND ${cardFacetTagVotes.userId} = ${userA}`,
      );
      expect(rows.length).toBe(1);
    }
  });

  it('reports per-tag vote counts and whether the caller voted', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB);
    const res = await service.getCardCommunityTags(variantIds[0], userA);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const a = res.data.find((t) => t.tag === TAG_A);
    expect(a?.votes).toBe(2);
    expect(a?.votedByMe).toBe(true);
    const c = await service.getCardCommunityTags(variantIds[0], userC);
    expect(c.success && c.data.find((t) => t.tag === TAG_A)?.votedByMe).toBe(false);
  });
});

describe('PostgresFacetService — community votes: audit + validation', () => {
  it('writes an append-only audit row on vote and on retract', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    await service.unvoteCardFacetTag(variantIds[0], TAG_A, userA);
    const rows = await db
      .select()
      .from(facetTagAudit)
      .where(sql`${facetTagAudit.tag} = ${TAG_A} AND ${facetTagAudit.userId} = ${userA}`);
    const actions = rows.map((r) => r.action).sort();
    expect(actions).toEqual(['add', 'remove']);
  });

  it('rejects a vote for a tag not in the vocabulary', async () => {
    const res = await service.voteCardFacetTag(variantIds[0], 'zzz-not-a-real-tag', userA);
    expect(res.success).toBe(false);
  });

  it('rejects a vote on an unknown card', async () => {
    const res = await service.voteCardFacetTag('zzz-no-such-card', TAG_A, userA);
    expect(res.success).toBe(false);
  });

  it('never mutates any cards column other than facet_tags', async () => {
    const cols = { name: cards.name, text: cards.text, power: cards.power, ccLegal: cards.ccLegal };
    const before = await db.select(cols).from(cards).where(eq(cards.cardUniqueId, variantIds[0]));
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB);
    await service.unvoteCardFacetTag(variantIds[0], TAG_A, userA);
    const after = await db.select(cols).from(cards).where(eq(cards.cardUniqueId, variantIds[0]));
    expect(after).toEqual(before);
  });
});
