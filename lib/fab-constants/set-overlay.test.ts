import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildSetOverlay, applySetOverlay, resetSetOverlay, EMPTY_SET_OVERLAY, type SetRow,
} from './set-overlay';
import {
  SET_MAP, SET_METADATA, CARD_FILTER_SETS, SET_FILTER_GROUPS,
  getSetMetadata, expandSetSelections, getOrderedSets,
} from './sets';
import { SET_IMAGES, getSetImageUrl, getSetImageOrFallback } from '@/lib/set-images';

/** DB rows exactly matching the compiled snapshot (in_card_filters NULL = "use the snapshot"). */
const SNAPSHOT_ROWS: SetRow[] = Object.entries(SET_METADATA).map(([code, m], i) => ({
    code,
    displayCode: m.code,
    name: m.name,
    releaseDate: m.releaseDate || null,
    releaseOrder: i + 1,
    displayOrder: m.displayOrder,
    category: m.category,
    tier: m.tier,
    hasFirstEdition: m.hasFirstEdition,
    unlimitedBeforeFirst: m.unlimitedBeforeFirst,
    defaultRarity: m.defaultRarity ?? null,
    imageId: null,
    inCardFilters: null,
  }));
// Captured before any overlay: SET_METADATA itself is patched by applySetOverlay.
const snapshotRows = () => SNAPSHOT_ROWS.map((r) => ({ ...r }));

const newSet = (over: Partial<SetRow> = {}): SetRow => ({
  code: 'zzn', displayCode: 'ZZN', name: 'Zz New Set', releaseDate: '2027-01-15',
  releaseOrder: 9999, displayOrder: 9999, category: 'standard', tier: 1,
  hasFirstEdition: false, unlimitedBeforeFirst: false, defaultRarity: null,
  imageId: null, inCardFilters: null, ...over,
});

afterEach(() => resetSetOverlay());

describe('buildSetOverlay', () => {
  it('is empty when the DB matches the compiled snapshot', () => {
    const o = buildSetOverlay(snapshotRows());
    expect(o.meta).toEqual({});
    expect(o.images).toEqual({});
    expect(o.filterSets).toBeNull();
  });

  it('carries a set the snapshot has never seen', () => {
    const o = buildSetOverlay([...snapshotRows(), newSet()]);
    expect(o.meta.zzn).toMatchObject({ code: 'ZZN', name: 'Zz New Set', releaseDate: '2027-01-15', category: 'standard' });
  });

  it('carries a changed name or date for an existing set', () => {
    const rows = snapshotRows().map((r) => (r.code === 'iar' ? { ...r, name: 'Renamed' } : r));
    expect(buildSetOverlay(rows).meta).toEqual({ iar: expect.objectContaining({ name: 'Renamed' }) });
  });

  it('takes a logo from sets.image_id but never removes a compiled one', () => {
    const rows = snapshotRows().map((r) => (r.code === 'wtr' ? { ...r, imageId: null } : r));
    const o = buildSetOverlay([...rows, newSet({ imageId: 'set-zzn-logo' })]);
    expect(o.images).toEqual({ zzn: 'set-zzn-logo' });
  });

  it('adds sets flagged in_card_filters to the front of the filter list, newest first', () => {
    const o = buildSetOverlay([
      ...snapshotRows(),
      newSet({ code: 'zza', releaseDate: '2027-01-01', inCardFilters: true }),
      newSet({ code: 'zzb', releaseDate: '2027-03-01', inCardFilters: true }),
      newSet({ code: 'zzc', inCardFilters: null }),
    ]);
    expect(o.filterSets!.slice(0, 2)).toEqual(['zzb', 'zza']);
    expect(o.filterSets!.slice(2)).toEqual([...CARD_FILTER_SETS]);
  });

  it('drops a compiled filter set the DB explicitly turns off', () => {
    const rows = snapshotRows().map((r) => (r.code === 'wtr' ? { ...r, inCardFilters: false } : r));
    expect(buildSetOverlay(rows).filterSets).toEqual(CARD_FILTER_SETS.filter((c) => c !== 'wtr'));
  });

  it('gives the same version to the same content', () => {
    const rows = [...snapshotRows(), newSet()];
    expect(buildSetOverlay(rows).version).toBe(buildSetOverlay(rows).version);
    expect(buildSetOverlay(rows).version).not.toBe(EMPTY_SET_OVERLAY.version);
  });
});

describe('applySetOverlay', () => {
  const overlay = () => buildSetOverlay([
    ...snapshotRows(),
    newSet({ imageId: 'set-zzn-logo', inCardFilters: true }),
    newSet({ code: 'zzd', displayCode: 'ZZD', name: 'Armory Deck: Zz', category: 'armory', tier: 4 }),
  ]);

  it('makes a new set visible to every sync helper', () => {
    applySetOverlay(overlay());
    expect(getSetMetadata('ZZN')?.name).toBe('Zz New Set');
    expect((SET_MAP as Record<string, string>).zzn).toBe('Zz New Set');
    expect(getOrderedSets().standard.map((s) => s.code)).toContain('ZZN');
  });

  it('puts the new set in the filter chips and its logo in SET_IMAGES', () => {
    applySetOverlay(overlay());
    expect(CARD_FILTER_SETS[0]).toBe('zzn');
    expect(getSetImageUrl('zzn')).toMatch(/\/set-zzn-logo\/public$/);
    expect(getSetImageOrFallback('zzn', 'ZZN')).toMatch(/set-zzn-logo/);
  });

  it('re-derives the deck-product groups', () => {
    applySetOverlay(overlay());
    expect(SET_FILTER_GROUPS.find((g) => g.token === 'grp:armory')!.codes).toContain('zzd');
    expect(expandSetSelections(['grp:armory'])).toContain('zzd');
  });

  it('is idempotent and resettable', () => {
    const before = { filters: [...CARD_FILTER_SETS], meta: Object.keys(SET_METADATA).length, images: { ...SET_IMAGES } };
    applySetOverlay(overlay());
    applySetOverlay(overlay());
    expect((CARD_FILTER_SETS as readonly string[]).filter((c) => c === 'zzn')).toHaveLength(1);
    resetSetOverlay();
    expect([...CARD_FILTER_SETS]).toEqual(before.filters);
    expect(Object.keys(SET_METADATA)).toHaveLength(before.meta);
    expect(SET_IMAGES).toEqual(before.images);
    expect(getSetMetadata('zzn')).toBeUndefined();
    expect(expandSetSelections(['grp:armory'])).not.toContain('zzd');
  });

  it('a newer overlay replaces an older one instead of stacking', () => {
    applySetOverlay(overlay());
    applySetOverlay(buildSetOverlay([...snapshotRows(), newSet({ code: 'zze', name: 'Other', inCardFilters: true })]));
    expect(getSetMetadata('zzn')).toBeUndefined();
    expect(CARD_FILTER_SETS).not.toContain('zzn');
    expect(CARD_FILTER_SETS[0]).toBe('zze');
  });
});

describe('separate module copies (Next.js server components vs SSR vs route handlers)', () => {
  it('a copy that never saw applySetOverlay picks the overlay up on its next helper call', async () => {
    vi.resetModules();
    const otherCopy = await import('./sets');
    expect(otherCopy.SET_MAP).not.toBe(SET_MAP); // really a second copy
    applySetOverlay(buildSetOverlay([...snapshotRows(), newSet({ inCardFilters: true })]));
    expect(otherCopy.getSetMetadata('zzn')?.name).toBe('Zz New Set');
    expect(otherCopy.CARD_FILTER_SETS[0]).toBe('zzn');
    resetSetOverlay();
    expect(otherCopy.getSetMetadata('zzn')).toBeUndefined();
  });
});
