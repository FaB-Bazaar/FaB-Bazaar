/**
 * Integration tests for collectible submissions (real local Docker DB).
 *
 * Crowdsourcing flow: signed-in users propose new playmats (collectibleId
 * null) or corrections to existing ones (collectibleId set); a superadmin
 * approves (applies to catalog) or rejects. Same isolation pattern as
 * PostgresCollectibleService.test.ts: randomUUID ids, afterEach deletes the
 * test users (cascade removes their submissions) and tracked collectibles.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, collectibles } from '@/lib/postgres/schema';
import { PostgresCollectibleService } from './PostgresCollectibleService';

const service = new PostgresCollectibleService();

let submitter: string;
let reviewer: string;
let createdCollectibleIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `zzz_colsub_${id.slice(0, 8)}` });
  return id;
}

async function makePlaymat(name?: string) {
  const result = await service.createCollectible(
    {
      name: name ?? `Sub Test Mat ${crypto.randomUUID().slice(0, 8)}`,
      artist: 'Original Artist',
      source: 'Original Event 2025',
      year: 2025,
    },
    reviewer,
  );
  if (!result.success) throw new Error('collectible setup failed');
  createdCollectibleIds.push(result.data.id);
  return result.data;
}

beforeEach(async () => {
  submitter = await makeUser();
  reviewer = await makeUser();
  createdCollectibleIds = [];
});

afterEach(async () => {
  if (createdCollectibleIds.length > 0) {
    await db.delete(collectibles).where(inArray(collectibles.id, createdCollectibleIds));
  }
  await db.delete(users).where(eq(users.id, submitter));
  await db.delete(users).where(eq(users.id, reviewer));
});

describe('collectible submissions', () => {
  describe('createSubmission', () => {
    it('creates a pending new-entry proposal with the submitted fields', async () => {
      const result = await service.createSubmission(submitter, {
        name: 'Community Found Mat',
        artist: 'Some Artist',
        source: 'Armory Kit 2024',
        year: 2024,
        notes: 'Saw this at my LGS',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.status).toBe('pending');
      expect(result.data.collectibleId).toBeNull();
      expect(result.data.name).toBe('Community Found Mat');
      expect(result.data.notes).toBe('Saw this at my LGS');
      expect(result.data.userId).toBe(submitter);
    });

    it('rejects a new-entry proposal without a name', async () => {
      const result = await service.createSubmission(submitter, {
        artist: 'Nameless',
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Name is required for new collectible suggestions');
    });

    it('creates an edit suggestion for an existing collectible without requiring a name', async () => {
      const mat = await makePlaymat();
      const result = await service.createSubmission(submitter, {
        collectibleId: mat.id,
        artist: 'Corrected Artist',
        notes: 'Artist credit is wrong',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.collectibleId).toBe(mat.id);
      expect(result.data.name).toBeNull();
      expect(result.data.artist).toBe('Corrected Artist');
    });

    it('returns a clean not-found error for an unknown collectibleId', async () => {
      const result = await service.createSubmission(submitter, {
        collectibleId: crypto.randomUUID(),
        artist: 'Whoever',
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Collectible not found');
    });

    it('rejects an edit suggestion that proposes no changes and no notes', async () => {
      const mat = await makePlaymat();
      const result = await service.createSubmission(submitter, { collectibleId: mat.id });
      expect(result.success).toBe(false);
    });

    it('caps pending submissions per user at 10', async () => {
      for (let i = 0; i < 10; i++) {
        const r = await service.createSubmission(submitter, { name: `Spam Mat ${i}` });
        expect(r.success).toBe(true);
      }
      const eleventh = await service.createSubmission(submitter, { name: 'Spam Mat 10' });
      expect(eleventh.success).toBe(false);
      if (eleventh.success) return;
      expect(eleventh.error).toMatch(/pending/i);
    });
  });

  describe('listSubmissions', () => {
    it('filters by status and joins submitter username + target collectible name', async () => {
      const mat = await makePlaymat('Join Target Mat');
      const created = await service.createSubmission(submitter, {
        collectibleId: mat.id,
        year: 2023,
      });
      if (!created.success) throw new Error('setup failed');

      const pending = await service.listSubmissions({ status: 'pending' });
      expect(pending.success).toBe(true);
      if (!pending.success) return;
      const mine = pending.data.find((s) => s.id === created.data.id);
      expect(mine).toBeDefined();
      expect(mine?.username).toMatch(/^zzz_colsub_/);
      expect(mine?.collectibleName).toBe('Join Target Mat');

      const approved = await service.listSubmissions({ status: 'approved' });
      expect(approved.success).toBe(true);
      if (!approved.success) return;
      expect(approved.data.find((s) => s.id === created.data.id)).toBeUndefined();
    });
  });

  describe('approveSubmission', () => {
    it('approving a new-entry proposal creates the catalog entry and closes the submission', async () => {
      const created = await service.createSubmission(submitter, {
        name: 'Approved New Mat',
        artist: 'New Artist',
        year: 2024,
      });
      if (!created.success) throw new Error('setup failed');

      const approved = await service.approveSubmission(created.data.id, reviewer);
      expect(approved.success).toBe(true);
      if (!approved.success) return;
      createdCollectibleIds.push(approved.data.collectible.id);
      expect(approved.data.collectible.name).toBe('Approved New Mat');
      expect(approved.data.collectible.artist).toBe('New Artist');

      const list = await service.listSubmissions({ status: 'approved' });
      expect(list.success).toBe(true);
      if (!list.success) return;
      const row = list.data.find((s) => s.id === created.data.id);
      expect(row?.status).toBe('approved');
      expect(row?.reviewedBy).toBe(reviewer);
      expect(row?.reviewedAt).not.toBeNull();
    });

    it('approving an edit suggestion applies only the proposed (non-null) fields', async () => {
      const mat = await makePlaymat('Keep My Name Mat');
      const created = await service.createSubmission(submitter, {
        collectibleId: mat.id,
        artist: 'Fixed Artist',
        year: 2022,
      });
      if (!created.success) throw new Error('setup failed');

      const approved = await service.approveSubmission(created.data.id, reviewer);
      expect(approved.success).toBe(true);
      if (!approved.success) return;
      expect(approved.data.collectible.id).toBe(mat.id);
      expect(approved.data.collectible.name).toBe('Keep My Name Mat'); // untouched
      expect(approved.data.collectible.source).toBe('Original Event 2025'); // untouched
      expect(approved.data.collectible.artist).toBe('Fixed Artist');
      expect(approved.data.collectible.year).toBe(2022);
    });

    it('cannot approve an already-reviewed submission', async () => {
      const created = await service.createSubmission(submitter, { name: 'Once Only Mat' });
      if (!created.success) throw new Error('setup failed');

      const first = await service.approveSubmission(created.data.id, reviewer);
      expect(first.success).toBe(true);
      if (first.success) createdCollectibleIds.push(first.data.collectible.id);

      const second = await service.approveSubmission(created.data.id, reviewer);
      expect(second.success).toBe(false);
      if (second.success) return;
      expect(second.error).toBe('Submission already reviewed');
    });

    it('returns not-found for an unknown submission id', async () => {
      const result = await service.approveSubmission(crypto.randomUUID(), reviewer);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Submission not found');
    });
  });

  describe('rejectSubmission', () => {
    it('marks the submission rejected without touching the catalog', async () => {
      const mat = await makePlaymat('Untouched Mat');
      const created = await service.createSubmission(submitter, {
        collectibleId: mat.id,
        artist: 'Wrong Correction',
      });
      if (!created.success) throw new Error('setup failed');

      const rejected = await service.rejectSubmission(created.data.id, reviewer);
      expect(rejected.success).toBe(true);

      const after = await service.getCollectible(mat.id);
      expect(after.success).toBe(true);
      if (!after.success) return;
      expect(after.data?.artist).toBe('Original Artist');

      const list = await service.listSubmissions({ status: 'rejected' });
      expect(list.success).toBe(true);
      if (!list.success) return;
      expect(list.data.find((s) => s.id === created.data.id)?.reviewedBy).toBe(reviewer);
    });

    it('cannot reject an already-reviewed submission', async () => {
      const created = await service.createSubmission(submitter, { name: 'Reject Twice Mat' });
      if (!created.success) throw new Error('setup failed');

      await service.rejectSubmission(created.data.id, reviewer);
      const second = await service.rejectSubmission(created.data.id, reviewer);
      expect(second.success).toBe(false);
      if (second.success) return;
      expect(second.error).toBe('Submission already reviewed');
    });
  });
});
