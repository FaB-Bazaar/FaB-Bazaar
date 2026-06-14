/**
 * Integration test: classTalentUnion ORs the Class and Talent filters into a
 * single affiliation union (a hero's pool is class ∪ talent ∪ generic), instead
 * of the default intersection. Runs against local Postgres.
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

describe('PostgresPrintingsService — classTalentUnion', () => {
  it('ORs class and talent into a union when the flag is set', async () => {
    const genericOnly = await total({ classes: ['generic'] });
    const lightningOnly = await total({ talents: ['lightning'] });
    const intersection = await total({ classes: ['generic'], talents: ['lightning'] });
    const union = await total({ classes: ['generic'], talents: ['lightning'], classTalentUnion: true });

    // |A ∪ B| = |A| + |B| − |A ∩ B|
    expect(union).toBe(genericOnly + lightningOnly - intersection);
    expect(union).toBeGreaterThan(genericOnly);
    expect(union).toBeGreaterThan(lightningOnly);
  });

  it('still intersects by default (no flag) — other callers unchanged', async () => {
    const genericOnly = await total({ classes: ['generic'] });
    const intersection = await total({ classes: ['generic'], talents: ['lightning'] });
    expect(intersection).toBeLessThan(genericOnly);
  });

  it('other AND filters still constrain the union (e.g. rarity)', async () => {
    const union = await total({ classes: ['generic'], talents: ['lightning'], classTalentUnion: true });
    const unionMajestic = await total({ classes: ['generic'], talents: ['lightning'], classTalentUnion: true, rarities: ['m'] });
    expect(unionMajestic).toBeLessThan(union);
    expect(unionMajestic).toBeGreaterThan(0);
  });
});
