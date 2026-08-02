/**
 * Filter model for the deck editor's mobile Cards tab: the curated kits are
 * ONE source filter (opt-in; 'all' is the default) rather than a separate
 * mode, plus pitch/type chips. Pure — the component just renders state and
 * passes the built filters to /api/search/core.
 */
import { describe, it, expect } from 'vitest';
import {
  buildMobileSearchFilters, isKitBrowse, hasChipFilters,
  defaultMobileSearchFilterState,
  type MobileSearchFilterState,
} from './mobile-search-filters';

const state = (over: Partial<MobileSearchFilterState> = {}): MobileSearchFilterState => ({
  source: 'kits', pitches: [], type: null, ...over,
});

const heroFilter = { heroClasses: ['pirate', 'necromancer'], heroTalents: [], heroEssences: [] };
const KIT_IDS = ['pid-a', 'pid-b', 'pid-c'];

const build = (s: MobileSearchFilterState, over: Record<string, unknown> = {}) =>
  buildMobileSearchFilters({
    state: s,
    parsed: { filters: {}, nameText: '' },
    kitPrintingIds: KIT_IDS,
    heroFilter,
    formatCode: 'blitz',
    ...over,
  } as any);

describe('isKitBrowse', () => {
  it('browses the kits when source=kits with no query and no chips', () => {
    expect(isKitBrowse(state(), '', true)).toBe(true);
  });

  it('leaves browse mode when a query is typed', () => {
    expect(isKitBrowse(state(), 'boarding party', true)).toBe(false);
  });

  it('leaves browse mode when a chip filter is active', () => {
    expect(isKitBrowse(state({ pitches: [1] }), '', true)).toBe(false);
    expect(isKitBrowse(state({ type: 'attack' }), '', false)).toBe(false);
  });

  it('never browses without kits or with source=all', () => {
    expect(isKitBrowse(state(), '', false)).toBe(false);
    expect(isKitBrowse(state({ source: 'all' }), '', true)).toBe(false);
  });
});

describe('defaultMobileSearchFilterState', () => {
  it("defaults the source to 'all' — the full hero+format-legal pool; kits are an explicit opt-in", () => {
    expect(defaultMobileSearchFilterState()).toEqual({ source: 'all', pitches: [], type: null });
  });

  it('returns a fresh object each call (safe to mutate as React state)', () => {
    expect(defaultMobileSearchFilterState()).not.toBe(defaultMobileSearchFilterState());
  });
});

describe('hasChipFilters', () => {
  it('reflects pitch/type selections', () => {
    expect(hasChipFilters(state())).toBe(false);
    expect(hasChipFilters(state({ pitches: [2] }))).toBe(true);
    expect(hasChipFilters(state({ type: 'item' }))).toBe(true);
  });
});

describe('buildMobileSearchFilters', () => {
  it('kits source scopes to the kit printings and skips hero/format scoping', () => {
    const f = build(state());
    expect(f.printingIds).toEqual(KIT_IDS);
    expect(f.heroClasses).toBeUndefined();
    expect(f.format).toBeUndefined();
    expect(f.isHero).toBe(false);
  });

  it('all source keeps the hero + format scoped pool (no printingIds)', () => {
    const f = build(state({ source: 'all' }));
    expect(f.printingIds).toBeUndefined();
    expect(f.heroClasses).toEqual(['pirate', 'necromancer']);
    expect(f.format).toBe('blitz');
    expect(f.isHero).toBe(false);
  });

  it('merges pitch and type chips into the filters', () => {
    const f = build(state({ source: 'all', pitches: [1, 3], type: 'attack' }));
    expect(f.pitch).toEqual([1, 3]);
    expect(f.types).toEqual(['attack']);
  });

  it('maps the non-attack-action chip to its API type and generic to isGenericOnly', () => {
    expect(build(state({ type: 'non-attack-action' })).types).toEqual(['action']);
    const g = build(state({ type: 'generic' }));
    expect(g.isGenericOnly).toBe(true);
    expect(g.types).toBeUndefined();
  });

  it('carries the parsed shorthand filters and name text', () => {
    const f = build(state({ source: 'all' }), {
      parsed: { filters: { keywords: ['go again'] }, nameText: 'boarding' },
    });
    expect(f.keywords).toEqual(['go again']);
    expect(f.name).toBe('boarding');
  });

  it('kit scoping still applies chip filters (search WITHIN the kits)', () => {
    const f = build(state({ pitches: [2] }));
    expect(f.printingIds).toEqual(KIT_IDS);
    expect(f.pitch).toEqual([2]);
  });
});
