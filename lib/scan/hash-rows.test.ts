// lib/scan/hash-rows.test.ts — validation for hash rows pushed to /api/admin/scan/hashes.
import { describe, it, expect } from 'vitest';
import { validateHashRows, chunk, MAX_HASH_ROWS_PER_REQUEST } from './hash-rows';

const row = (over: Record<string, unknown> = {}) => ({ printingId: 'p1', phash: 'ABCDEF0123456789', dhash: '0000000000000000', artHash: 'ffffffffffffffff', imageUrl: 'https://x/y', ...over });

describe('validateHashRows', () => {
  it('accepts rows and lowercases hex', () => {
    const r = validateHashRows([row()]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toEqual({ printingId: 'p1', phash: 'abcdef0123456789', dhash: '0000000000000000', artHash: 'ffffffffffffffff', imageUrl: 'https://x/y' });
  });
  it('allows a null dhash (rows imported from the fab-cube dataset)', () => {
    const r = validateHashRows([row({ dhash: null })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0].dhash).toBeNull();
  });
  it('allows a missing or null artHash (pre-0110 rows) and normalises it to null', () => {
    const r = validateHashRows([row({ artHash: undefined }), row({ printingId: 'p2', artHash: null })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map(x => x.artHash)).toEqual([null, null]);
  });
  it.each([
    ['not an array', 'nope', /array/],
    ['empty', [], /empty/],
    ['bad phash', [row({ phash: 'xyz' })], /row 0.*phash/],
    ['bad dhash length', [row({ dhash: '0000' })], /row 0.*dhash/],
    ['bad dhash type', [row({ dhash: 5 })], /row 0.*dhash/],
    ['bad artHash', [row({ artHash: 'zz' })], /row 0.*artHash/],
    ['missing printingId', [row({ printingId: '' })], /row 0.*printingId/],
    ['missing imageUrl', [row({ imageUrl: 3 })], /row 0.*imageUrl/],
  ])('rejects %s', (_n, input, msg) => {
    const r = validateHashRows(input);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(msg);
  });
  it('rejects more than the per-request cap', () => {
    const r = validateHashRows(Array.from({ length: MAX_HASH_ROWS_PER_REQUEST + 1 }, (_, i) => row({ printingId: 'p' + i })));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(new RegExp(String(MAX_HASH_ROWS_PER_REQUEST)));
  });
  it('dedupes by printingId, last wins (one INSERT … ON CONFLICT cannot take a key twice)', () => {
    const r = validateHashRows([row({ imageUrl: 'first' }), row({ imageUrl: 'second' })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].imageUrl).toBe('second');
  });
});

describe('chunk', () => {
  it('splits into batches of the given size with a remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
