/**
 * Integration tests for MCP usage capture (per-user, per-client, per-tool
 * daily aggregates). This is the observability substrate for future hosted-AI
 * quotas: raw byte counts are stored; token estimates are derived at read time.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, mcpUsageDaily } from '@/lib/postgres/schema';
import { PostgresMcpUsageService } from './PostgresMcpUsageService';

const service = new PostgresMcpUsageService();

let testUserId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId)); // cascade removes usage rows
});

describe('recordCall', () => {
  it('creates a daily row and accumulates repeat calls into it', async () => {
    const call = { userId: testUserId, client: 'lm-studio', tool: 'search_printings', requestBytes: 200, responseBytes: 5000 };

    expect((await service.recordCall(call)).success).toBe(true);
    expect((await service.recordCall({ ...call, requestBytes: 100, responseBytes: 3000 })).success).toBe(true);

    const rows = await db.select().from(mcpUsageDaily).where(eq(mcpUsageDaily.userId, testUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0].calls).toBe(2);
    expect(rows[0].requestBytes).toBe(300);
    expect(rows[0].responseBytes).toBe(8000);
  });

  it('keeps separate rows per tool and per client', async () => {
    await service.recordCall({ userId: testUserId, client: 'claude', tool: 'search_printings', requestBytes: 1, responseBytes: 1 });
    await service.recordCall({ userId: testUserId, client: 'claude', tool: 'list_binders', requestBytes: 1, responseBytes: 1 });
    await service.recordCall({ userId: testUserId, client: 'lm-studio', tool: 'list_binders', requestBytes: 1, responseBytes: 1 });

    const rows = await db.select().from(mcpUsageDaily).where(eq(mcpUsageDaily.userId, testUserId));
    expect(rows).toHaveLength(3);
  });
});

describe('getUserUsage', () => {
  it('returns per-tool rows and totals with a derived token estimate', async () => {
    await service.recordCall({ userId: testUserId, client: 'claude', tool: 'search_printings', requestBytes: 400, responseBytes: 7600 });
    await service.recordCall({ userId: testUserId, client: 'claude', tool: 'list_binders', requestBytes: 100, responseBytes: 1900 });

    const result = await service.getUserUsage(testUserId, 30);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.rows).toHaveLength(2);
    expect(result.data.totals.calls).toBe(2);
    expect(result.data.totals.requestBytes).toBe(500);
    expect(result.data.totals.responseBytes).toBe(9500);
    // ~4 bytes/token heuristic over combined traffic
    expect(result.data.totals.estimatedTokens).toBe(2500);
  });

  it('returns empty totals for a user with no usage', async () => {
    const result = await service.getUserUsage(testUserId, 30);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.rows).toHaveLength(0);
    expect(result.data.totals.calls).toBe(0);
  });
});
