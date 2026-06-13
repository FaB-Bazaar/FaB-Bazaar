import { describe, it, expect } from 'vitest';
import { buildServerFilters, type SearchUiState } from './build-server-filters';
import { FORMAT_OPTIONS } from './card-filter-chips';

const baseState: SearchUiState = {
  query: '',
  selectedType: null,
  selectedClass: null,
  selectedPitch: null,
  selectedKeywords: [],
  selectedRarities: [],
  selectedFoilings: [],
  selectedEditions: [],
  selectedSets: [],
  costMin: '', costMax: '',
  powerMin: '', powerMax: '',
  defenseMin: '', defenseMax: '',
  priceMax: '',
};

describe('buildServerFilters — format', () => {
  it('maps selectedFormat to filters.format', () => {
    const f = buildServerFilters({ ...baseState, selectedFormat: 'cc' });
    expect(f.format).toBe('cc');
  });

  it('omits format when no format is selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('format');
  });

  it('lets the format chip win over a shorthand format: term', () => {
    const f = buildServerFilters({
      ...baseState,
      query: 'format:blitz t:attack',
      selectedFormat: 'silver_age',
    });
    expect(f.format).toBe('silver_age');
  });

  it('still parses shorthand format: when no chip is selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'format:cc t:attack' });
    expect(f.format).toBe('cc');
  });
});

describe('FORMAT_OPTIONS', () => {
  it('covers the five supported formats, CC and Silver Age first', () => {
    expect(FORMAT_OPTIONS.map(o => o.value)).toEqual([
      'cc', 'silver_age', 'blitz', 'll', 'commoner',
    ]);
  });

  it('uses full display names', () => {
    const labels = Object.fromEntries(FORMAT_OPTIONS.map(o => [o.value, o.label]));
    expect(labels.cc).toBe('Classic Constructed');
    expect(labels.silver_age).toBe('Silver Age');
    expect(labels.ll).toBe('Living Legend');
  });
});
