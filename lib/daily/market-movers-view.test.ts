import { describe, it, expect } from 'vitest';
import { filterMarketMovers } from './market-movers-view';

const row = (displayName: string, foiling: string, pAtSignal: number | null, pctChange: number | null = 10) =>
  ({ displayName, foiling, pAtSignal, pctChange });
const names = (r: { displayName: string }[]) => r.map((x) => x.displayName);

describe('filterMarketMovers', () => {
  const rows = [row('Cheap NF', 's', 2), row('Mid RF', 'R', 25), row('Big CF', 'c', 300), row('No price', 's', null)];

  it('returns every row with no filters', () => {
    expect(filterMarketMovers(rows, { minPrice: 0, foiling: 'all' })).toBe(rows);
  });

  it('keeps cards at or above the price floor', () => {
    expect(names(filterMarketMovers(rows, { minPrice: 25, foiling: 'all' }))).toEqual(['Mid RF', 'Big CF']);
  });

  it('splits foil from non-foil, any letter case', () => {
    expect(names(filterMarketMovers(rows, { minPrice: 0, foiling: 'foil' }))).toEqual(['Mid RF', 'Big CF']);
    expect(names(filterMarketMovers(rows, { minPrice: 0, foiling: 'nonfoil' }))).toEqual(['Cheap NF', 'No price']);
  });

  it('applies both filters together', () => {
    expect(names(filterMarketMovers(rows, { minPrice: 100, foiling: 'foil' }))).toEqual(['Big CF']);
  });
});
