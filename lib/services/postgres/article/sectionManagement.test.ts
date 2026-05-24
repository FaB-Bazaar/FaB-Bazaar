/**
 * Integration tests for PostgresArticleService section mutation methods.
 *
 * Covers: appendSection, appendSections, insertSection, updateSection, deleteSection
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

const seedSections = [
  { type: 'text', content: 'Section A' },
  { type: 'text', content: 'Section B' },
];

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
    title: 'Test Article',
    slug: `test-article-${articleId.slice(0, 8)}`,
    contentType: 'article',
    status: 'draft',
    authorId: testUserId,
    sections: seedSections,
    content: '',
    categories: [],
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('PostgresArticleService.appendSection', () => {
  it('appends a section to the end and bumps updatedAt', async () => {
    const before = (await db.select().from(articles).where(eq(articles.id, articleId)))[0];

    const result = await service.appendSection(publicId, testUserId, {
      type: 'text',
      content: 'Section C',
    } as any);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections).toHaveLength(3);
    expect(result.data.sections[2]).toMatchObject({ type: 'text', content: 'Section C' });

    const after = (await db.select().from(articles).where(eq(articles.id, articleId)))[0];
    expect((after.sections as any[]).length).toBe(3);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it('looks up by internal id as well as publicId', async () => {
    const result = await service.appendSection(articleId, testUserId, {
      type: 'callout',
      text: 'hello',
    } as any);
    expect(result.success).toBe(true);
  });

  it('rejects when article does not belong to userId', async () => {
    const result = await service.appendSection(publicId, otherUserId, { type: 'text', content: 'x' } as any);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/access denied|not found/i);

    const row = (await db.select().from(articles).where(eq(articles.id, articleId)))[0];
    expect((row.sections as any[]).length).toBe(2);
  });

  it('returns not-found when article does not exist', async () => {
    const result = await service.appendSection('does-not-exist-xyz', testUserId, { type: 'text', content: 'x' } as any);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found/i);
  });
});

describe('PostgresArticleService.appendSections', () => {
  it('appends multiple sections preserving order', async () => {
    const result = await service.appendSections(publicId, testUserId, [
      { type: 'text', content: 'C' },
      { type: 'text', content: 'D' },
      { type: 'text', content: 'E' },
    ] as any);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections).toHaveLength(5);
    expect((result.data.sections[2] as any).content).toBe('C');
    expect((result.data.sections[3] as any).content).toBe('D');
    expect((result.data.sections[4] as any).content).toBe('E');
  });

  it('is a no-op for an empty array', async () => {
    const result = await service.appendSections(publicId, testUserId, []);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections).toHaveLength(2);
  });
});

describe('PostgresArticleService.insertSection', () => {
  it('inserts at the requested index, shifting later sections right', async () => {
    const result = await service.insertSection(
      publicId,
      testUserId,
      { type: 'text', content: 'A.5' } as any,
      1
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections.map((s: any) => s.content)).toEqual(['Section A', 'A.5', 'Section B']);
  });

  it('inserting at length appends to the end', async () => {
    const result = await service.insertSection(
      publicId,
      testUserId,
      { type: 'text', content: 'tail' } as any,
      2
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections).toHaveLength(3);
    expect((result.data.sections[2] as any).content).toBe('tail');
  });

  it('rejects an out-of-range index', async () => {
    const result = await service.insertSection(
      publicId,
      testUserId,
      { type: 'text', content: 'x' } as any,
      99
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/index/i);
  });
});

describe('PostgresArticleService.updateSection', () => {
  it('replaces the section at the given index', async () => {
    const result = await service.updateSection(
      publicId,
      testUserId,
      { type: 'callout', text: 'replaced' } as any,
      0
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections).toHaveLength(2);
    expect((result.data.sections[0] as any).type).toBe('callout');
    expect((result.data.sections[0] as any).text).toBe('replaced');
    expect((result.data.sections[1] as any).content).toBe('Section B');
  });

  it('rejects an out-of-range index', async () => {
    const result = await service.updateSection(
      publicId,
      testUserId,
      { type: 'text', content: 'x' } as any,
      5
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/index/i);
  });

  it('rejects when article does not belong to userId', async () => {
    const result = await service.updateSection(
      publicId,
      otherUserId,
      { type: 'text', content: 'x' } as any,
      0
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/access denied|not found/i);
  });
});

describe('PostgresArticleService.deleteSection', () => {
  it('removes the section at the given index', async () => {
    const result = await service.deleteSection(publicId, testUserId, 0);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sections).toHaveLength(1);
    expect((result.data.sections[0] as any).content).toBe('Section B');
  });

  it('rejects an out-of-range index', async () => {
    const result = await service.deleteSection(publicId, testUserId, 7);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/index/i);
  });
});
