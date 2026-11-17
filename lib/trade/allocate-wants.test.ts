import { describe, it, expect } from 'vitest';
import { allocateToWants, wantKey } from './allocate-wants';

type Row = { id: string; key: string; qty: number };
const rows = (...r: Row[]) => r;
const alloc = (r: Row[], wanted: Record<string, number>) =>
  allocateToWants(r, new Map(Object.entries(wanted)), (x) => x.key, (x) => x.qty).map(
    (a) => [a.row.id, a.quantity]
  );

describe('allocateToWants', () => {
  it('caps at the wanted quantity when the binder has more', () => {
    expect(alloc(rows({ id: 'a', key: 'p1', qty: 4 }), { p1: 2 })).toEqual([['a', 2]]);
  });

  it('caps at the available quantity when the viewer wants more', () => {
    expect(alloc(rows({ id: 'a', key: 'p1', qty: 1 }), { p1: 3 })).toEqual([['a', 1]]);
  });

  it('spreads one want across rows that share a key, never exceeding it', () => {
    expect(
      alloc(rows({ id: 'a', key: 'p1', qty: 1 }, { id: 'b', key: 'p1', qty: 3 }, { id: 'c', key: 'p1', qty: 2 }), { p1: 3 })
    ).toEqual([['a', 1], ['b', 2]]);
  });

  it('drops rows whose key is not wanted', () => {
    expect(alloc(rows({ id: 'a', key: 'p9', qty: 2 }), { p1: 1 })).toEqual([]);
  });

  it('does not consume the caller’s map', () => {
    const wanted = new Map([['p1', 2]]);
    allocateToWants([{ id: 'a', key: 'p1', qty: 5 }], wanted, (x) => x.key, (x) => x.qty);
    expect(wanted.get('p1')).toBe(2);
  });
});

describe('wantKey', () => {
  it('keys exact matches by printing and loose matches by card', () => {
    const r = { printingId: 'P', cardUniqueId: 'C' };
    expect(wantKey(r, 'exact')).toBe('P');
    expect(wantKey(r, 'loose')).toBe('C');
  });
});
