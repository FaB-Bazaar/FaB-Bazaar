/**
 * Integration test: base-keyword filters match parameterized variants.
 * Keywords are stored WITH their value ("arcane barrier 1", "amp x", "quell
 * 1"), so filtering on the base form ("arcane barrier") must catch every
 * variant — an exact array overlap returns 0 and reads as "no such cards"
 * (hit by Volzar's "Find all Ninja armor that has arcane barrier" prompt).
 * Runs against local Postgres.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';

const service = new PostgresPrintingsService();

const search = async (filters: PrintingsSearchFilters) => {
  const r = await service.searchPrintings(filters, { groupByCard: true, limit: 100 });
  if (!r.success) throw new Error(r.error);
  return r.data;
};

describe('PostgresPrintingsService — parameterized keyword filters', () => {
  it('matches the base keyword against its stored "keyword N" variants', async () => {
    const data = await search({ keywords: ['arcane barrier'], classes: ['ninja'], types: ['equipment'] });
    expect(data.total).toBeGreaterThan(0);
    const names = data.printings.map((p) => p.name);
    expect(names).toContain('Tide Flippers');
    expect(
      data.printings.every((p) => p.keywords?.some((k: string) => k === 'arcane barrier' || k.startsWith('arcane barrier '))),
    ).toBe(true);
  });

  it('still matches an exact parameterized value without widening it', async () => {
    const exact = await search({ keywords: ['arcane barrier 2'] });
    expect(exact.total).toBeGreaterThan(0);
    expect(exact.printings.every((p) => p.keywords?.includes('arcane barrier 2'))).toBe(true);
  });

  it('keywordsNot excludes every parameterized variant of the base keyword', async () => {
    const data = await search({ classes: ['ninja'], types: ['equipment'], keywordsNot: ['arcane barrier'] });
    expect(data.total).toBeGreaterThan(0); // other ninja equipment survives
    const names = data.printings.map((p) => p.name);
    expect(names).not.toContain('Tide Flippers');
  });
});
