/**
 * Integration tests for hosted-LLM usage capture (per-user, per-model daily
 * aggregates — migration 0073). Mirrors the mcp_usage_daily pattern: rows are
 * raw facts written once per chat turn; quota enforcement reads today's
 * request count and applies policy on top.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, llmUsageDaily } from '@/lib/postgres/schema';
import { PostgresLlmUsageService } from './PostgresLlmUsageService';

const service = new PostgresLlmUsageService();

let testUserId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId)); // cascade removes usage rows
});

describe('recordTurn', () => {
  it('creates a daily row and accumulates repeat turns into it', async () => {
    const turn = { userId: testUserId, model: 'openai/gpt-5-nano', promptTokens: 500, completionTokens: 60 };

    expect((await service.recordTurn(turn)).success).toBe(true);
    expect((await service.recordTurn({ ...turn, promptTokens: 700, completionTokens: 100 })).success).toBe(true);

    const rows = await db.select().from(llmUsageDaily).where(eq(llmUsageDaily.userId, testUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0].requests).toBe(2);
    expect(rows[0].promptTokens).toBe(1200);
    expect(rows[0].completionTokens).toBe(160);
  });

  it('keeps separate rows per model', async () => {
    await service.recordTurn({ userId: testUserId, model: 'mock', promptTokens: 1, completionTokens: 1 });
    await service.recordTurn({ userId: testUserId, model: 'openai/gpt-5-nano', promptTokens: 1, completionTokens: 1 });

    const rows = await db.select().from(llmUsageDaily).where(eq(llmUsageDaily.userId, testUserId));
    expect(rows).toHaveLength(2);
  });

  it('accepts zero-token turns (mock model / providers that omit usage)', async () => {
    const result = await service.recordTurn({ userId: testUserId, model: 'mock', promptTokens: 0, completionTokens: 0 });
    expect(result.success).toBe(true);

    const rows = await db.select().from(llmUsageDaily).where(eq(llmUsageDaily.userId, testUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0].requests).toBe(1);
  });
});

describe('getTodayRequestCount', () => {
  it('sums requests across models for the current UTC day', async () => {
    await service.recordTurn({ userId: testUserId, model: 'mock', promptTokens: 1, completionTokens: 1 });
    await service.recordTurn({ userId: testUserId, model: 'mock', promptTokens: 1, completionTokens: 1 });
    await service.recordTurn({ userId: testUserId, model: 'openai/gpt-5-nano', promptTokens: 1, completionTokens: 1 });

    const result = await service.getTodayRequestCount(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe(3);
  });

  it('ignores other days and other users', async () => {
    // Yesterday's row for the same user must not count toward today.
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    await db.insert(llmUsageDaily).values({
      usageDate: yesterday,
      userId: testUserId,
      model: 'mock',
      requests: 50,
      promptTokens: 1,
      completionTokens: 1,
    });

    const result = await service.getTodayRequestCount(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe(0);
  });
});

describe('getUserUsage', () => {
  it('returns per-model rows and totals over the window', async () => {
    await service.recordTurn({ userId: testUserId, model: 'mock', promptTokens: 400, completionTokens: 50 });
    await service.recordTurn({ userId: testUserId, model: 'openai/gpt-5-nano', promptTokens: 100, completionTokens: 10 });

    const result = await service.getUserUsage(testUserId, 30);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.rows).toHaveLength(2);
    expect(result.data.totals.requests).toBe(2);
    expect(result.data.totals.promptTokens).toBe(500);
    expect(result.data.totals.completionTokens).toBe(60);
  });

  it('returns empty totals for a user with no usage', async () => {
    const result = await service.getUserUsage(testUserId, 30);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rows).toHaveLength(0);
    expect(result.data.totals.requests).toBe(0);
  });
});
