/**
 * Integration test: getSetGroups returns the TCGplayer packs present in a set.
 *
 * Drives the conditional pack filter — the UI shows a pack picker only for sets
 * that actually have more than one tcg_group (e.g. GEM's seasonal packs), and
 * hides it for ordinary single-group sets.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService.getSetGroups', () => {
  it('lists the GEM packs present in the set, with names and counts', async () => {
    const res = await service.getSetGroups('gem');
    expect(res.success).toBe(true);
    if (!res.success) return;

    // 5 GEM packs are seeded + backfilled.
    expect(res.data.length).toBe(5);
    const pack5 = res.data.find((g) => g.groupId === 24720);
    expect(pack5?.name).toBe('GEM Pack 5');
    expect(pack5?.count ?? 0).toBeGreaterThan(0);
  });

  it('orders packs by published date (Pack 1 → Pack 5)', async () => {
    const res = await service.getSetGroups('gem');
    expect(res.success).toBe(true);
    if (!res.success) return;
    const names = res.data.map((g) => g.name);
    expect(names).toEqual(['GEM Pack 1', 'GEM Pack 2', 'GEM Pack 3', 'GEM Pack 4', 'GEM Pack 5']);
  });

  it('returns an empty array for an ordinary single-group set (hides the picker)', async () => {
    const res = await service.getSetGroups('wtr');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual([]);
  });
});
