/**
 * Unit tests for search descriptor description (deep-link card subtitles)
 * and misplaced-key warnings (LLM self-correction feedback).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn() },
}));

import { describeSearchDescriptor, warnOnMisplacedDescriptorKeys } from './searchPrintings';

describe('describeSearchDescriptor', () => {
  it('describes a shorthand query', () => {
    expect(describeSearchDescriptor({ query: 'rf cnc alpha' })).toBe('"rf cnc alpha"');
  });

  it('describes structured filters compactly', () => {
    expect(describeSearchDescriptor({
      filters: { name: 'Pummel', pitch: 1, rarities: ['r'], sets: ['wtr'], priceMax: 25 },
    })).toBe('"Pummel" · sets wtr · rarity r · red · under $25');
  });

  it('names the danger case: hero pool with no other constraints', () => {
    expect(describeSearchDescriptor({
      filters: { heroLegal: 'Oscilio, Constella Intelligence' },
    })).toBe('legal for Oscilio, Constella Intelligence');
  });

  it('describes a facetTags search instead of "no filters"', () => {
    expect(describeSearchDescriptor({ filters: { facetTags: ['disruption'] } })).toBe('tagged disruption');
    expect(describeSearchDescriptor({ filters: { facetTags: ['disruption', 'combo-enabler'] } }))
      .toBe('tagged disruption/combo-enabler');
    // ALL mode joins with + to signal "must have every tag"
    expect(describeSearchDescriptor({ filters: { facetTags: ['disruption', 'combo-enabler'], facetTagsMode: 'all' } }))
      .toBe('tagged disruption+combo-enabler');
  });

  it('combines tags with other constraints', () => {
    expect(describeSearchDescriptor({ filters: { facetTags: ['disruption'], classes: ['ninja'] } }))
      .toBe('ninja · tagged disruption');
  });

  it('flags a completely unconstrained search', () => {
    expect(describeSearchDescriptor({ filters: {} })).toBe('no filters — the entire card pool');
  });
});

describe('warnOnMisplacedDescriptorKeys', () => {
  it('returns null for clean descriptors', () => {
    expect(warnOnMisplacedDescriptorKeys([{ query: 'x' }, { filters: { name: 'y' }, options: {} }])).toBeNull();
  });

  it('names misplaced keys and shows the fix', () => {
    const warning = warnOnMisplacedDescriptorKeys([
      { filters: { heroLegal: 'Oscilio' }, priceMin: 0, priceMax: 100 },
    ]);
    expect(warning).toContain('priceMin');
    expect(warning).toContain('priceMax');
    expect(warning).toContain('INSIDE filters');
  });
});
