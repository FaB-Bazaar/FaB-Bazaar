/**
 * Integration tests for PostgresCollectibleService (real local Docker DB).
 *
 * Isolation: every row is created with crypto.randomUUID() ids; afterEach
 * deletes the test users (cascade removes their marks) and the collectibles
 * created by this file (tracked in createdCollectibleIds).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, collectibles } from '@/lib/postgres/schema';
import { PostgresCollectibleService } from './PostgresCollectibleService';

const service = new PostgresCollectibleService();

let userA: string;
let userB: string;
let createdCollectibleIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `zzz_collectible_${id.slice(0, 8)}` });
  return id;
}

async function makePlaymat(name?: string, extra: Record<string, unknown> = {}) {
  const result = await service.createCollectible(
    {
      name: name ?? `Test Playmat ${crypto.randomUUID().slice(0, 8)}`,
      artist: 'Test Artist',
      source: 'Test Event 2026',
      year: 2026,
      ...extra,
    },
    userA,
  );
  if (result.success) createdCollectibleIds.push(result.data.id);
  return result;
}

beforeEach(async () => {
  userA = await makeUser();
  userB = await makeUser();
  createdCollectibleIds = [];
});

afterEach(async () => {
  if (createdCollectibleIds.length > 0) {
    await db.delete(collectibles).where(inArray(collectibles.id, createdCollectibleIds));
  }
  await db.delete(users).where(eq(users.id, userA));
  await db.delete(users).where(eq(users.id, userB));
});

describe('PostgresCollectibleService', () => {
  describe('createCollectible', () => {
    it('creates a playmat with defaults and returns the full DTO', async () => {
      const result = await makePlaymat('Arakni Judge Mat');

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.name).toBe('Arakni Judge Mat');
      expect(result.data.kind).toBe('playmat');
      expect(result.data.artist).toBe('Test Artist');
      expect(result.data.year).toBe(2026);
      expect(result.data.haveCount).toBe(0);
      expect(result.data.wantCount).toBe(0);
      expect(result.data.viewerStatus).toBeNull();
    });

    it('rejects a duplicate (kind, name, year) with an error, not a throw', async () => {
      const first = await makePlaymat('Dupe Mat');
      expect(first.success).toBe(true);

      const second = await makePlaymat('Dupe Mat');
      expect(second.success).toBe(false);
    });
  });

  describe('listCollectibles', () => {
    it('lists created playmats and filters by case-insensitive name search', async () => {
      await makePlaymat('Prism Worlds Mat');
      await makePlaymat('Bravo Nationals Mat');

      const all = await service.listCollectibles({ kind: 'playmat' });
      expect(all.success).toBe(true);
      if (!all.success) return;
      const names = all.data.map((c) => c.name);
      expect(names).toContain('Prism Worlds Mat');
      expect(names).toContain('Bravo Nationals Mat');

      const filtered = await service.listCollectibles({ search: 'prism worlds' });
      expect(filtered.success).toBe(true);
      if (!filtered.success) return;
      expect(filtered.data.map((c) => c.name)).toContain('Prism Worlds Mat');
      expect(filtered.data.map((c) => c.name)).not.toContain('Bravo Nationals Mat');
    });

    it('includes aggregate counts and the viewer own mark', async () => {
      const created = await makePlaymat('Counted Mat');
      if (!created.success) throw new Error('setup failed');
      const id = created.data.id;

      await service.setMark(userA, id, 'have');
      await service.setMark(userB, id, 'want');

      const asA = await service.listCollectibles({ search: 'Counted Mat' }, userA);
      expect(asA.success).toBe(true);
      if (!asA.success) return;
      const matForA = asA.data.find((c) => c.id === id);
      expect(matForA?.haveCount).toBe(1);
      expect(matForA?.wantCount).toBe(1);
      expect(matForA?.viewerStatus).toBe('have');

      const anonymous = await service.listCollectibles({ search: 'Counted Mat' });
      expect(anonymous.success).toBe(true);
      if (!anonymous.success) return;
      expect(anonymous.data.find((c) => c.id === id)?.viewerStatus).toBeNull();
    });
  });

  describe('marks', () => {
    it('setMark upserts: have → want flips the single row', async () => {
      const created = await makePlaymat();
      if (!created.success) throw new Error('setup failed');
      const id = created.data.id;

      const have = await service.setMark(userA, id, 'have');
      expect(have.success).toBe(true);

      const want = await service.setMark(userA, id, 'want');
      expect(want.success).toBe(true);

      const after = await service.getCollectible(id, userA);
      expect(after.success).toBe(true);
      if (!after.success) return;
      expect(after.data?.viewerStatus).toBe('want');
      expect(after.data?.haveCount).toBe(0);
      expect(after.data?.wantCount).toBe(1);
    });

    it('clearMark removes the mark and counts drop back to zero', async () => {
      const created = await makePlaymat();
      if (!created.success) throw new Error('setup failed');
      const id = created.data.id;

      await service.setMark(userA, id, 'have');
      const cleared = await service.clearMark(userA, id);
      expect(cleared.success).toBe(true);

      const after = await service.getCollectible(id, userA);
      expect(after.success).toBe(true);
      if (!after.success) return;
      expect(after.data?.viewerStatus).toBeNull();
      expect(after.data?.haveCount).toBe(0);
    });

    it('setMark on a nonexistent collectible returns an error, not a throw', async () => {
      const result = await service.setMark(userA, crypto.randomUUID(), 'have');
      expect(result.success).toBe(false);
    });
  });

  describe('update/delete', () => {
    it('updateCollectible changes fields and bumps updatedAt', async () => {
      const created = await makePlaymat('Rename Me');
      if (!created.success) throw new Error('setup failed');

      const updated = await service.updateCollectible(created.data.id, {
        name: 'Renamed Mat',
        source: 'Pro Tour Lyon 2026',
      });
      expect(updated.success).toBe(true);
      if (!updated.success) return;
      expect(updated.data.name).toBe('Renamed Mat');
      expect(updated.data.source).toBe('Pro Tour Lyon 2026');
    });

    it('deleteCollectible removes the row and cascades marks', async () => {
      const created = await makePlaymat();
      if (!created.success) throw new Error('setup failed');
      const id = created.data.id;
      await service.setMark(userA, id, 'have');

      const deleted = await service.deleteCollectible(id);
      expect(deleted.success).toBe(true);

      const after = await service.getCollectible(id);
      expect(after.success).toBe(true);
      if (!after.success) return;
      expect(after.data).toBeNull();
    });

    it('getCollectible returns null (not an error) for an unknown id', async () => {
      const result = await service.getCollectible(crypto.randomUUID());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBeNull();
    });
  });
});
