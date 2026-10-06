/**
 * Server half of the runtime set registry: loads the `sets` table (real local
 * DB in the first test), builds the overlay, applies it to this process.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { refreshSetOverlay, getSetOverlay, __resetSetOverlayServerForTests } from './set-overlay-server';
import { resetSetOverlay, EMPTY_SET_OVERLAY, type SetRow } from './set-overlay';
import { getSetMetadata, CARD_FILTER_SETS } from './sets';

afterEach(() => { __resetSetOverlayServerForTests(); resetSetOverlay(); });

const row = (over: Partial<SetRow> = {}): SetRow => ({
  code: 'zzs', displayCode: 'ZZS', name: 'Zz Server Set', releaseDate: '2027-02-01', releaseOrder: 9999,
  displayOrder: 9999, category: 'standard', tier: 1, hasFirstEdition: false, unlimitedBeforeFirst: false,
  defaultRarity: null, imageId: null, inCardFilters: true, ...over,
});

describe('refreshSetOverlay', () => {
  it('the live sets table matches the compiled snapshot (in_card_filters backfilled from CARD_FILTER_SETS)', async () => {
    const o = await refreshSetOverlay();
    // New/changed sets may legitimately exist in a DB ahead of the snapshot;
    // the filter-chip backfill must reproduce the compiled list exactly.
    expect(o.filterSets === null || o.filterSets.slice(-CARD_FILTER_SETS.length).join() === [...CARD_FILTER_SETS].join()).toBe(true);
    expect(Object.keys(o.meta).every((code) => !['wtr', 'iar', 'mpw'].includes(code))).toBe(true);
  });

  it('applies the DB rows to this process', async () => {
    const o = await refreshSetOverlay(async () => [row()]);
    expect(o.meta.zzs).toBeDefined();
    expect(getSetMetadata('zzs')?.name).toBe('Zz Server Set');
    expect(CARD_FILTER_SETS[0]).toBe('zzs');
  });

  it('keeps the last good overlay when the DB read fails', async () => {
    await refreshSetOverlay(async () => [row()]);
    const o = await refreshSetOverlay(async () => { throw new Error('db down'); });
    expect(o.meta.zzs).toBeDefined();
    expect(getSetMetadata('zzs')).toBeDefined();
  });
});

describe('getSetOverlay', () => {
  it('returns the cached overlay while fresh and reloads once stale', async () => {
    let calls = 0;
    const loader = async () => { calls++; return [row({ name: `call ${calls}` })]; };
    let now = 1_000_000;
    const a = await getSetOverlay({ loader, now: () => now, ttlMs: 60_000 });
    now += 30_000;
    await getSetOverlay({ loader, now: () => now, ttlMs: 60_000 });
    expect(calls).toBe(1);
    now += 31_000;
    const b = await getSetOverlay({ loader, now: () => now, ttlMs: 60_000 });
    expect(calls).toBe(2);
    expect(a.version).not.toBe(b.version);
  });

  it('starts from the empty overlay before any load', async () => {
    expect((await getSetOverlay({ loader: async () => { throw new Error('no db'); } })).version).toBe(EMPTY_SET_OVERLAY.version);
  });
});
