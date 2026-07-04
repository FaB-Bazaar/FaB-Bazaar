import { db } from '@/lib/postgres/db';
import { llmUsageDaily } from '@/lib/postgres/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';

// UTC day, matching mcp_usage_daily. Quotas reset at midnight UTC.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LlmTurnUsage {
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface LlmUsageRow {
  usageDate: string;
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

export interface LlmUsageSummary {
  rows: LlmUsageRow[];
  totals: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
  };
}

export class PostgresLlmUsageService {
  /**
   * Increment the daily aggregate for one chat turn. Callers treat this as
   * fire-and-forget: it must never throw, and a failure must never affect the
   * turn being measured. Token counts are provider-reported (0 when the
   * provider omits usage, e.g. the mock model).
   */
  async recordTurn(turn: LlmTurnUsage): AsyncResult<void> {
    try {
      await db
        .insert(llmUsageDaily)
        .values({
          usageDate: todayUtc(),
          userId: turn.userId,
          model: turn.model,
          requests: 1,
          promptTokens: turn.promptTokens,
          completionTokens: turn.completionTokens,
        })
        .onConflictDoUpdate({
          target: [llmUsageDaily.usageDate, llmUsageDaily.userId, llmUsageDaily.model],
          set: {
            requests: sql`${llmUsageDaily.requests} + 1`,
            promptTokens: sql`${llmUsageDaily.promptTokens} + ${turn.promptTokens}`,
            completionTokens: sql`${llmUsageDaily.completionTokens} + ${turn.completionTokens}`,
          },
        });
      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to record LLM usage' };
    }
  }

  /**
   * Requests made today (UTC) across all models — the quota-check input.
   * A daily message budget compares this against the user's tier limit.
   */
  async getTodayRequestCount(userId: string): AsyncResult<number> {
    try {
      const [row] = await db
        .select({ requests: sql<number>`coalesce(sum(${llmUsageDaily.requests}), 0)::int` })
        .from(llmUsageDaily)
        .where(and(eq(llmUsageDaily.userId, userId), eq(llmUsageDaily.usageDate, todayUtc())));

      return { success: true, data: row?.requests ?? 0 };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to read LLM usage' };
    }
  }

  /** Per-model daily rows plus totals for one user over the last `days` days. */
  async getUserUsage(userId: string, days: number): AsyncResult<LlmUsageSummary> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(llmUsageDaily)
        .where(and(eq(llmUsageDaily.userId, userId), gte(llmUsageDaily.usageDate, since)));

      const totals = rows.reduce(
        (acc, r) => ({
          requests: acc.requests + r.requests,
          promptTokens: acc.promptTokens + r.promptTokens,
          completionTokens: acc.completionTokens + r.completionTokens,
        }),
        { requests: 0, promptTokens: 0, completionTokens: 0 },
      );

      return {
        success: true,
        data: {
          rows: rows.map(({ userId: _u, ...rest }) => rest),
          totals,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to read LLM usage' };
    }
  }

  /** All-user daily totals over the last `days` days (admin observability). */
  async getDailySummary(days: number): AsyncResult<Array<{ usageDate: string; userId: string; model: string; requests: number; promptTokens: number; completionTokens: number }>> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const rows = await db
        .select({
          usageDate: llmUsageDaily.usageDate,
          userId: llmUsageDaily.userId,
          model: llmUsageDaily.model,
          requests: sql<number>`sum(${llmUsageDaily.requests})::int`,
          promptTokens: sql<number>`sum(${llmUsageDaily.promptTokens})::bigint`,
          completionTokens: sql<number>`sum(${llmUsageDaily.completionTokens})::bigint`,
        })
        .from(llmUsageDaily)
        .where(gte(llmUsageDaily.usageDate, since))
        .groupBy(llmUsageDaily.usageDate, llmUsageDaily.userId, llmUsageDaily.model);

      return { success: true, data: rows };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to summarize LLM usage' };
    }
  }
}
