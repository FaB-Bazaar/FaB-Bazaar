/**
 * Integration tests for the facet SUGGESTION review queue (migration 0080).
 * Users propose new vocabulary; a curator approves (minting a definition) or
 * rejects. Suggestions never touch cards.facet_tags. Runs against local Postgres
 * with throwaway users and zzz- slugs.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { PostgresFacetService } from './PostgresFacetService';
import { db } from '@/lib/postgres/db';
import { users, facetTagDefinitions, facetTagSuggestions } from '@/lib/postgres/schema';

const service = new PostgresFacetService();
// Only THESE slugs — never a broad `LIKE 'zzz-%'`, which would clobber the
// definitions other facet test files create while they run in parallel.
const OWN_SLUGS = ['zzz-suggested-tag', 'zzz-approve-me', 'zzz-clean-slug', 'zzz-taken', 'zzz-late'];
let proposer: string;
let reviewer: string;

beforeAll(async () => {
  proposer = crypto.randomUUID();
  reviewer = crypto.randomUUID();
  await db.insert(users).values([
    { id: proposer, username: `zzz_sug_prop_${proposer.slice(0, 8)}` },
    { id: reviewer, username: `zzz_sug_rev_${reviewer.slice(0, 8)}` },
  ]);
});

afterEach(async () => {
  await db.delete(facetTagSuggestions).where(inArray(facetTagSuggestions.proposedBy, [proposer]));
  await db.delete(facetTagDefinitions).where(inArray(facetTagDefinitions.id, OWN_SLUGS));
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [proposer, reviewer]));
});

describe('PostgresFacetService — suggestions', () => {
  it('creates a pending suggestion', async () => {
    const res = await service.createSuggestion({
      proposedId: 'zzz-suggested-tag',
      dim: 'mechanical',
      label: 'Suggested Tag',
      def: 'does a thing',
      rationale: 'we need this',
      proposedBy: proposer,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.status).toBe('pending');
    expect(res.data.proposedBy).toBe(proposer);
  });

  it('lists pending suggestions and excludes them once resolved', async () => {
    const created = await service.createSuggestion({ dim: 'strategic', label: 'X', proposedBy: proposer });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const pending = await service.listSuggestions('pending');
    expect(pending.success && pending.data.some((s) => s.id === created.data.id)).toBe(true);

    await service.rejectSuggestion(created.data.id, reviewer);
    const stillPending = await service.listSuggestions('pending');
    expect(stillPending.success && stillPending.data.some((s) => s.id === created.data.id)).toBe(false);
  });

  it('approving a suggestion mints a tag definition and marks it approved', async () => {
    const created = await service.createSuggestion({
      proposedId: 'zzz-approve-me',
      dim: 'mechanical',
      label: 'Approve Me',
      def: 'defn',
      proposedBy: proposer,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const approved = await service.approveSuggestion(created.data.id, reviewer);
    expect(approved.success).toBe(true);
    if (!approved.success) return;
    expect(approved.data.id).toBe('zzz-approve-me');

    const defs = await service.listTagDefinitions();
    expect(defs.success && defs.data.some((d) => d.id === 'zzz-approve-me')).toBe(true);

    const [row] = await db.select().from(facetTagSuggestions).where(eq(facetTagSuggestions.id, created.data.id));
    expect(row.status).toBe('approved');
    expect(row.reviewedBy).toBe(reviewer);
  });

  it('lets a curator override the final slug on approval', async () => {
    const created = await service.createSuggestion({ proposedId: 'zzz-bad slug', dim: 'synergy', label: 'Y', proposedBy: proposer });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const approved = await service.approveSuggestion(created.data.id, reviewer, { id: 'zzz-clean-slug' });
    expect(approved.success && approved.data.id).toBe('zzz-clean-slug');
  });

  it('refuses to approve when the target slug already exists', async () => {
    await service.createTagDefinition({ id: 'zzz-taken', dim: 'mechanical', label: 'Taken' });
    const created = await service.createSuggestion({ proposedId: 'zzz-taken', dim: 'mechanical', label: 'Dup', proposedBy: proposer });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const approved = await service.approveSuggestion(created.data.id, reviewer);
    expect(approved.success).toBe(false);
  });

  it('refuses to re-resolve an already-resolved suggestion', async () => {
    const created = await service.createSuggestion({ dim: 'mechanical', label: 'Z', proposedBy: proposer });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await service.rejectSuggestion(created.data.id, reviewer);
    const again = await service.approveSuggestion(created.data.id, reviewer, { id: 'zzz-late' });
    expect(again.success).toBe(false);
  });

  it('rejects an invalid dimension', async () => {
    const res = await service.createSuggestion({ dim: 'bogus' as any, label: 'Q', proposedBy: proposer });
    expect(res.success).toBe(false);
  });
});
