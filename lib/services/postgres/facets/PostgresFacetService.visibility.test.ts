/**
 * Integration tests for the facet-vote VISIBILITY + APPROVAL lifecycle
 * (migration 0083). Runs against local Postgres.
 *
 * Model:
 *   - vote(..., 'private')  -> status 'private'; creator-only, never counted.
 *   - vote(..., 'public')   -> status 'pending'; awaiting curator approval.
 *   - approve -> 'public' (counts toward the >= 2 distinct-voter threshold).
 *   - reject  -> 'private'.
 * A tag projects into cards.facet_tags only with >= 2 'public' votes (curator
 * tags stay authoritative regardless). private/pending never project.
 *
 * Fixture card: 'Adrenaline Rush' (distinct from other facet test files:
 * Absorb in Aether, Aether Dart, Sink Below). Throwaway zzz- tags + users.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { PostgresFacetService } from './PostgresFacetService';
import { db } from '@/lib/postgres/db';
import { cards, users, cardFacetTags, cardFacetTagVotes, facetTagAudit, facetTagDefinitions } from '@/lib/postgres/schema';

const service = new PostgresFacetService();
const TAG_A = 'zzz-vis-facet-a';
const TAG_B = 'zzz-vis-facet-b';
const TEST_TAGS = [TAG_A, TAG_B];

let variantIds: string[];
let userA: string;
let userB: string;
let curator: string;

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `zzz_vis_${id.slice(0, 8)}` });
  return id;
}

beforeAll(async () => {
  const rows = await db.select({ id: cards.cardUniqueId }).from(cards).where(eq(cards.displayName, 'Adrenaline Rush'));
  variantIds = rows.map((r) => r.id);
  userA = await makeUser();
  userB = await makeUser();
  curator = await makeUser();
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
  await db.delete(users).where(inArray(users.id, [userA, userB, curator]));
});

async function projectedTags(cardId: string): Promise<string[]> {
  const [r] = await db.select({ ft: cards.facetTags }).from(cards).where(eq(cards.cardUniqueId, cardId));
  return r?.ft ?? [];
}
async function statusOf(cardId: string, tag: string, userId: string): Promise<string | undefined> {
  const [r] = await db
    .select({ s: cardFacetTagVotes.status })
    .from(cardFacetTagVotes)
    .where(and(eq(cardFacetTagVotes.cardUniqueId, cardId), eq(cardFacetTagVotes.tag, tag), eq(cardFacetTagVotes.userId, userId)));
  return r?.s;
}

describe('facet vote visibility — casting', () => {
  it('defaults to private when visibility is omitted (creator-only, never projects)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA);
    expect(await statusOf(variantIds[0], TAG_A, userA)).toBe('private');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('a public vote lands as pending (awaiting approval) and does not project', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    expect(await statusOf(variantIds[0], TAG_A, userA)).toBe('pending');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('two pending public votes still do not project (approval required)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'public');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('private votes never count toward the threshold (two private voters, no projection)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'private');
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'private');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });
});

describe('facet vote visibility — approval', () => {
  it('approving a pending vote sets it public', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    const res = await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    expect(res.success).toBe(true);
    expect(await statusOf(variantIds[0], TAG_A, userA)).toBe('public');
  });

  it('projects a tag once two approved public votes exist', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    await service.approveFacetVote(variantIds[0], TAG_A, userB, curator);
    for (const id of variantIds) expect(await projectedTags(id)).toContain(TAG_A);
  });

  it('a single approved public vote stays below threshold (creator-only, no projection)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('rejecting a pending vote demotes it to private (and never projects)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    await service.rejectFacetVote(variantIds[0], TAG_A, userB, curator);
    expect(await statusOf(variantIds[0], TAG_A, userB)).toBe('private');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });
});

describe('facet vote visibility — toggling + queue', () => {
  it('toggling a private vote to public moves it to pending (needs approval)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'private');
    await service.setFacetVoteVisibility(variantIds[0], TAG_A, userA, 'public');
    expect(await statusOf(variantIds[0], TAG_A, userA)).toBe('pending');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('toggling public back to private is immediate (no approval, un-projects)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    await service.approveFacetVote(variantIds[0], TAG_A, userB, curator);
    await service.setFacetVoteVisibility(variantIds[0], TAG_A, userA, 'private');
    expect(await statusOf(variantIds[0], TAG_A, userA)).toBe('private');
    for (const id of variantIds) expect(await projectedTags(id)).not.toContain(TAG_A);
  });

  it('lists pending public requests and clears them after approval', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    const before = await service.listPendingFacetVotes();
    expect(before.success).toBe(true);
    if (!before.success) return;
    expect(before.data.some((p) => p.tag === TAG_A && p.userId === userA)).toBe(true);
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    const after = await service.listPendingFacetVotes();
    expect(after.success && after.data.some((p) => p.tag === TAG_A && p.userId === userA)).toBe(false);
  });
});

describe('facet summary respects visibility', () => {
  async function summaryTags(cardId: string, viewerId?: string) {
    const res = await service.getFacetSummaryForCards([cardId], viewerId);
    if (!res.success) throw new Error(res.error);
    return res.data[cardId] ?? [];
  }

  it("hides another user's private tag from the public summary", async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'private');
    const tags = (await summaryTags(variantIds[0])).map((t) => t.tag);
    expect(tags).not.toContain(TAG_A);
  });

  it('shows the viewer their OWN private tag (mine=true, zero public votes)', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'private');
    const t = (await summaryTags(variantIds[0], userA)).find((x) => x.tag === TAG_A);
    expect(t?.mine).toBe(true);
    expect(t?.votes).toBe(0);
  });

  it("public count reflects only public votes (another user's private vote doesn't inflate it)", async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'private');
    const t = (await summaryTags(variantIds[0])).find((x) => x.tag === TAG_A);
    expect(t?.votes).toBe(1);
  });
});

describe('getCardCommunityTags respects visibility + reports own status', () => {
  it("hides another user's private tag from a different viewer", async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'private');
    const res = await service.getCardCommunityTags(variantIds[0], userB);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.some((t) => t.tag === TAG_A)).toBe(false);
  });

  it("reports the viewer's own tag with its status (pending) and zero public count", async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public'); // -> pending
    const res = await service.getCardCommunityTags(variantIds[0], userA);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const t = res.data.find((x) => x.tag === TAG_A);
    expect(t?.myStatus).toBe('pending');
    expect(t?.votes).toBe(0); // not yet counted publicly
  });

  it('null myStatus when the viewer has not voted the (public) tag', async () => {
    await service.voteCardFacetTag(variantIds[0], TAG_A, userA, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userA, curator);
    await service.voteCardFacetTag(variantIds[0], TAG_A, userB, 'public');
    await service.approveFacetVote(variantIds[0], TAG_A, userB, curator);
    const res = await service.getCardCommunityTags(variantIds[0], curator); // curator never voted TAG_A
    expect(res.success).toBe(true);
    if (!res.success) return;
    const t = res.data.find((x) => x.tag === TAG_A);
    expect(t?.myStatus ?? null).toBeNull();
    expect(t?.votes).toBe(2);
  });
});
