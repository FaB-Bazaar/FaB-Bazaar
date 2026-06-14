/**
 * Integration tests for the heroAges search filter (adult / young, OR-combined).
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService — heroAges filter', () => {
  it('young returns only young heroes', async () => {
    const res = await service.searchPrintings({ heroAges: ['young'] }, { limit: 60, groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    expect(res.data.printings.every((p) => (p.types ?? []).includes('young'))).toBe(true);
  });

  it('adult returns heroes that are NOT young', async () => {
    const res = await service.searchPrintings({ heroAges: ['adult'] }, { limit: 60, groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    expect(res.data.printings.every((p) => p.is_hero && !(p.types ?? []).includes('young'))).toBe(true);
  });

  it('both ages is the OR union — more than young alone', async () => {
    const both = await service.searchPrintings({ heroAges: ['adult', 'young'] }, { limit: 1, groupByCard: true });
    const young = await service.searchPrintings({ heroAges: ['young'] }, { limit: 1, groupByCard: true });
    expect(both.success && young.success).toBe(true);
    if (!both.success || !young.success) return;
    expect(both.data.total).toBeGreaterThan(young.data.total);
  });
});
