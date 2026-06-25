/**
 * Integration test: searchPrintings filters by TCGplayer group (pack).
 *
 * Powers the per-GEM-pack filter on /sets/GEM and /opt. Every GEM printing is
 * tagged with the tcg_group_id of its seasonal pack (migration 0067/0068), so
 * filtering by group narrows the set to a single pack.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const GEM_PACK_5 = 24720;
const GEM_PACK_1 = 24176;

describe('PostgresPrintingsService.searchPrintings — tcgGroupIds filter', () => {
  it('restricts results to printings in the given pack', async () => {
    const res = await service.searchPrintings(
      { sets: ['gem'], tcgGroupIds: [GEM_PACK_5] },
      { limit: 500, groupByCard: false },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.printings.length).toBeGreaterThan(0);
    // Every returned printing must belong to Pack 5.
    for (const p of res.data.printings) {
      expect(p.tcg_group_id).toBe(GEM_PACK_5);
      expect(p.set).toBe('gem');
    }
  });

  it('supports multiple packs (union)', async () => {
    const res = await service.searchPrintings(
      { sets: ['gem'], tcgGroupIds: [GEM_PACK_1, GEM_PACK_5] },
      { limit: 1000, groupByCard: false },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;

    const groups = new Set(res.data.printings.map((p) => p.tcg_group_id));
    expect(groups).toEqual(new Set([GEM_PACK_1, GEM_PACK_5]));
  });

  it('returns fewer results than the whole set (the filter actually narrows)', async () => {
    const all = await service.searchPrintings({ sets: ['gem'] }, { limit: 1000, groupByCard: false });
    const pack5 = await service.searchPrintings(
      { sets: ['gem'], tcgGroupIds: [GEM_PACK_5] },
      { limit: 1000, groupByCard: false },
    );
    expect(all.success && pack5.success).toBe(true);
    if (!all.success || !pack5.success) return;
    expect(pack5.data.printings.length).toBeLessThan(all.data.printings.length);
  });
});
