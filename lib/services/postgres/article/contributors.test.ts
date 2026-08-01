/**
 * Integration tests for article contributors (co-author credits).
 *
 * Contributors are stored as JSONB on articles and must round-trip through
 * createArticle / getArticleByPublicId / updateArticle. Invalid payloads are
 * rejected at the service layer (single validation gate).
 * Runs against the real local PostgreSQL database.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users } from '@/lib/postgres/schema';
import { PostgresArticleService } from './PostgresArticleService';

const service = new PostgresArticleService();

let testUserId: string;
const createdPublicIds: string[] = [];

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `t-${testUserId.slice(0, 6)}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  createdPublicIds.length = 0;
});

const CONTRIBUTORS = [
  { role: 'Deck by', name: 'John Smith', link: 'https://twitter.com/johnsmith' },
  { name: 'mistercakes' },
];

async function createWithContributors(contributors?: unknown) {
  const result = await service.createArticle(testUserId, {
    title: 'Co-authored Strategy Deep Dive',
    contentType: 'strategy',
    sections: [{ type: 'text', content: 'body' }],
    ...(contributors !== undefined ? { contributors } : {}),
  } as any);
  if (result.success) createdPublicIds.push(result.data.publicId);
  return result;
}

describe('article contributors round-trip', () => {
  it('createArticle persists contributors and returns them in the DTO', async () => {
    const result = await createWithContributors(CONTRIBUTORS);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contributors).toEqual(CONTRIBUTORS);
  });

  it('getArticleByPublicId returns stored contributors', async () => {
    const created = await createWithContributors(CONTRIBUTORS);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const fetched = await service.getArticleByPublicId(created.data.publicId);
    expect(fetched.success).toBe(true);
    if (!fetched.success || !fetched.data) return;
    expect(fetched.data.contributors).toEqual(CONTRIBUTORS);
  });

  it('an article created without contributors has none', async () => {
    const result = await createWithContributors(undefined);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contributors ?? []).toEqual([]);
  });

  it('updateArticle replaces contributors', async () => {
    const created = await createWithContributors(CONTRIBUTORS);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const replacement = [{ role: 'Strategy by', name: 'Jane Doe' }];
    const updated = await service.updateArticle(created.data._id!, testUserId, {
      contributors: replacement,
    } as any);

    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.contributors).toEqual(replacement);
  });

  it('updateArticle leaves contributors untouched when not provided', async () => {
    const created = await createWithContributors(CONTRIBUTORS);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateArticle(created.data._id!, testUserId, {
      title: 'Renamed',
    });

    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.contributors).toEqual(CONTRIBUTORS);
  });

  it('updateArticle can clear contributors with an empty array', async () => {
    const created = await createWithContributors(CONTRIBUTORS);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateArticle(created.data._id!, testUserId, {
      contributors: [],
    } as any);

    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.contributors ?? []).toEqual([]);
  });

  it('rejects invalid contributors on create', async () => {
    const result = await createWithContributors([{ role: 'Deck by' }]); // missing name
    expect(result.success).toBe(false);
  });

  it('rejects invalid contributors on update', async () => {
    const created = await createWithContributors(CONTRIBUTORS);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateArticle(created.data._id!, testUserId, {
      contributors: [{ name: 'J', link: 'javascript:alert(1)' }],
    } as any);

    expect(updated.success).toBe(false);

    // Stored value untouched
    const fetched = await service.getArticleByPublicId(created.data.publicId);
    expect(fetched.success).toBe(true);
    if (!fetched.success || !fetched.data) return;
    expect(fetched.data.contributors).toEqual(CONTRIBUTORS);
  });
});
