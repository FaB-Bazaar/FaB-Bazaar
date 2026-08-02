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

describe('PostgresPrintingsService — genericTalentless (generic leg excludes talented cards)', () => {
  it('generic alone: matches only talent-free generic cards', async () => {
    const allGeneric = await total({ classes: ['generic'] });
    const talentFree = await total({ classes: ['generic'], talentless: true });
    const flagged = await total({ classes: ['generic'], genericTalentless: true });

    expect(talentFree).toBeLessThan(allGeneric); // talented generics exist in the catalog
    expect(flagged).toBe(talentFree);
  });

  it('generic + talent union: talent leg re-admits its talented cards (incl. talented generics)', async () => {
    const talentFreeGeneric = await total({ classes: ['generic'], talentless: true });
    const light = await total({ talents: ['light'] });
    const union = await total({
      classes: ['generic'], genericTalentless: true,
      talents: ['light'], classTalentUnion: true,
    });

    // The two legs are disjoint (a talent-free card can't carry the light
    // talent), so the union is the plain sum.
    expect(union).toBe(talentFreeGeneric + light);
  });

  it('mixed classes: only the generic leg is talent-stripped — talented warriors stay', async () => {
    const plainMixed = await total({ classes: ['generic', 'warrior'] });
    const allTalentless = await total({ classes: ['generic', 'warrior'], talentless: true });
    const flagged = await total({ classes: ['generic', 'warrior'], genericTalentless: true });

    expect(flagged).toBeLessThan(plainMixed);      // talented generics dropped
    expect(flagged).toBeGreaterThan(allTalentless); // talented warriors kept
  });

  it('flag is a no-op when generic is not among the selected classes', async () => {
    const plain = await total({ classes: ['warrior'] });
    const flagged = await total({ classes: ['warrior'], genericTalentless: true });
    expect(flagged).toBe(plain);
  });
});
