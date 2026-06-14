/**
 * Integration test: the `talentless` filter restricts results to cards with no
 * talent — e.g. Illusionist + talentless excludes draconic/mystic illusionist
 * cards a pure Illusionist hero can't play. Runs against local Postgres.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';

const service = new PostgresPrintingsService();

const total = async (filters: PrintingsSearchFilters) => {
  const r = await service.searchPrintings(filters, { groupByCard: true, limit: 1 });
  if (!r.success) throw new Error(r.error);
  return r.data.total;
};

describe('PostgresPrintingsService — talentless filter', () => {
  it('narrows a class to its talentless cards only', async () => {
    const all = await total({ classes: ['illusionist'] });
    const talentless = await total({ classes: ['illusionist'], talentless: true });
    expect(talentless).toBeGreaterThan(0);
    expect(talentless).toBeLessThan(all);
  });

  it('returns only cards with an empty talents array', async () => {
    const r = await service.searchPrintings(
      { classes: ['illusionist'], talentless: true },
      { groupByCard: true, limit: 50 },
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.printings.length).toBeGreaterThan(0);
    expect(r.data.printings.every((p) => !p.talents || p.talents.length === 0)).toBe(true);
  });
});
