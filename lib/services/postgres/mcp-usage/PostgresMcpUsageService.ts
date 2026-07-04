import { db } from '@/lib/postgres/db';
import { mcpUsageDaily } from '@/lib/postgres/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';

// ~4 bytes/token for JSON-heavy MCP traffic. Estimation lives at READ time so
// the stored rows stay raw facts and the heuristic can change without a backfill.
const BYTES_PER_TOKEN = 4;

export interface McpUsageCall {
  userId: string;
  client: string;
  tool: string;
  requestBytes: number;
  responseBytes: number;
}

export interface McpUsageRow {
  usageDate: string;
  client: string;
  tool: string;
  calls: number;
  requestBytes: number;
  responseBytes: number;
}

export interface McpUsageSummary {
  rows: McpUsageRow[];
  totals: {
    calls: number;
    requestBytes: number;
    responseBytes: number;
    estimatedTokens: number;
  };
}

export class PostgresMcpUsageService {
  /**
   * Increment the daily aggregate for one tool call. Callers treat this as
   * fire-and-forget: it must never throw, and a failure must never affect the
   * request being measured.
   */
  async recordCall(call: McpUsageCall): AsyncResult<void> {
    try {
      const usageDate = new Date().toISOString().slice(0, 10);
      await db
        .insert(mcpUsageDaily)
        .values({
          usageDate,
          userId: call.userId,
          client: call.client || 'unknown',
          tool: call.tool,
          calls: 1,
          requestBytes: call.requestBytes,
          responseBytes: call.responseBytes,
        })
        .onConflictDoUpdate({
          target: [mcpUsageDaily.usageDate, mcpUsageDaily.userId, mcpUsageDaily.client, mcpUsageDaily.tool],
          set: {
            calls: sql`${mcpUsageDaily.calls} + 1`,
            requestBytes: sql`${mcpUsageDaily.requestBytes} + ${call.requestBytes}`,
            responseBytes: sql`${mcpUsageDaily.responseBytes} + ${call.responseBytes}`,
          },
        });
      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to record MCP usage' };
    }
  }

  /** Per-tool rows plus totals for one user over the last `days` days. */
  async getUserUsage(userId: string, days: number): AsyncResult<McpUsageSummary> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(mcpUsageDaily)
        .where(and(eq(mcpUsageDaily.userId, userId), gte(mcpUsageDaily.usageDate, since)));

      const totals = rows.reduce(
        (acc, r) => ({
          calls: acc.calls + r.calls,
          requestBytes: acc.requestBytes + r.requestBytes,
          responseBytes: acc.responseBytes + r.responseBytes,
        }),
        { calls: 0, requestBytes: 0, responseBytes: 0 },
      );

      return {
        success: true,
        data: {
          rows: rows.map(({ userId: _u, ...rest }) => rest),
          totals: {
            ...totals,
            estimatedTokens: Math.round((totals.requestBytes + totals.responseBytes) / BYTES_PER_TOKEN),
          },
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to read MCP usage' };
    }
  }

  /** All-user daily totals over the last `days` days (admin observability). */
  async getDailySummary(days: number): AsyncResult<Array<{ usageDate: string; userId: string; calls: number; requestBytes: number; responseBytes: number }>> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const rows = await db
        .select({
          usageDate: mcpUsageDaily.usageDate,
          userId: mcpUsageDaily.userId,
          calls: sql<number>`sum(${mcpUsageDaily.calls})::int`,
          requestBytes: sql<number>`sum(${mcpUsageDaily.requestBytes})::int`,
          responseBytes: sql<number>`sum(${mcpUsageDaily.responseBytes})::int`,
        })
        .from(mcpUsageDaily)
        .where(gte(mcpUsageDaily.usageDate, since))
        .groupBy(mcpUsageDaily.usageDate, mcpUsageDaily.userId);

      return { success: true, data: rows };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to summarize MCP usage' };
    }
  }
}
