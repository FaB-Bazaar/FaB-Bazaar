/**
 * Integration tests for PostgresArticleService.updateUserArticle contentType handling.
 *
 * The PATCH route now forwards contentType for publish-time metadata edits;
 * these tests lock in the service-layer behavior that route depends on.
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, articles } from '@/lib/postgres/schema';
import { PostgresArticleService } from './PostgresArticleService';

const service = new PostgresArticleService();

let testUserId: string;
let otherUserId: string;
let articleId: string;
let publicId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  otherUserId = crypto.randomUUID();
  articleId = crypto.randomUUID();
  publicId = `pub-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(users).values([
    { id: testUserId, username: `t-${testUserId.slice(0, 6)}` },
    { id: otherUserId, username: `o-${otherUserId.slice(0, 6)}` },
  ]);

  await db.insert(articles).values({
    id: articleId,
    publicId,
    title: 'Quick Write Draft',
    slug: `quick-write-${articleId.slice(0, 8)}`,
    contentType: 'strategy',
    status: 'draft',
    authorId: testUserId,
    isUserArticle: true,
    sections: [{ type: 'text', content: 'body' }],
    content: '',
    categories: [],
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('PostgresArticleService.updateUserArticle contentType', () => {
  it('persists a contentType change (publish-time metadata)', async () => {
    const result = await service.updateUserArticle(publicId, testUserId, {
      contentType: 'tournament',
      status: 'published',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contentType).toBe('tournament');
    expect(result.data.status).toBe('published');

    const row = (await db.select().from(articles).where(eq(articles.id, articleId)))[0];
    expect(row.contentType).toBe('tournament');
  });

  it('leaves contentType untouched when not provided', async () => {
    const result = await service.updateUserArticle(publicId, testUserId, {
      title: 'Renamed',
    });

    expect(result.success).toBe(true);
    const row = (await db.select().from(articles).where(eq(articles.id, articleId)))[0];
    expect(row.contentType).toBe('strategy');
  });

  it('rejects updates from a non-owner', async () => {
    const result = await service.updateUserArticle(publicId, otherUserId, {
      contentType: 'tournament',
    });

    expect(result.success).toBe(false);
    const row = (await db.select().from(articles).where(eq(articles.id, articleId)))[0];
    expect(row.contentType).toBe('strategy');
  });
});
