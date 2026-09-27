import { describe, it, expect } from 'vitest';
import { sortMarketMovers } from './sort-market-movers';

const row = (displayName: string, set: string, pAtSignal: number | null, pctChange: number | null) =>
  ({ displayName, set, pAtSignal, pctChange });

const rows = [
  row('Beta', 'wtr', 50, 10),   // 2019
  row('Alpha', 'dtd', 200, -30), // 2023
  row('Gamma', 'hnt', 5, 150),   // 2024
];
const names = (r: { displayName: string }[]) => r.map((x) => x.displayName);

describe('sortMarketMovers', () => {
  it('keeps the incoming (signal-rank) order when unsorted', () => {
    expect(names(sortMarketMovers(rows, null))).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('sorts by price', () => {
    expect(names(sortMarketMovers(rows, { key: 'price', dir: 'desc' }))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(names(sortMarketMovers(rows, { key: 'price', dir: 'asc' }))).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('sorts by % change', () => {
    expect(names(sortMarketMovers(rows, { key: 'change', dir: 'desc' }))).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('sorts by set release date, newest first when descending', () => {
    expect(names(sortMarketMovers(rows, { key: 'set', dir: 'desc' }))).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(names(sortMarketMovers(rows, { key: 'set', dir: 'asc' }))).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('sorts by name', () => {
    expect(names(sortMarketMovers(rows, { key: 'name', dir: 'asc' }))).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('puts missing values last in either direction', () => {
    const withGaps = [...rows, row('NoPrice', 'zzz', null, null)];
    expect(names(sortMarketMovers(withGaps, { key: 'price', dir: 'desc' })).at(-1)).toBe('NoPrice');
    expect(names(sortMarketMovers(withGaps, { key: 'price', dir: 'asc' })).at(-1)).toBe('NoPrice');
    expect(names(sortMarketMovers(withGaps, { key: 'set', dir: 'desc' })).at(-1)).toBe('NoPrice');
  });

  it('does not mutate its input', () => {
    const copy = [...rows];
    sortMarketMovers(rows, { key: 'price', dir: 'asc' });
    expect(rows).toEqual(copy);
  });
});
