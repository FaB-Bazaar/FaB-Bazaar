/**
 * Unit tests for the set-to-binder helpers:
 * - buildSetBinderName: "{displayUsername} - {SETCODE}"
 * - dedupeSetPrintings: one printing per (collector_number, foiling),
 *   preferring the regular (non-art-variant) printing.
 */

import { describe, it, expect } from 'vitest';
import { buildSetBinderName, dedupeSetPrintings, type SetBinderPrinting } from './set-binder';

const p = (
  printing_id: string,
  collector_number: string,
  foiling: string,
  art_variations: string[] = []
): SetBinderPrinting => ({ printing_id, collector_number, foiling, art_variations });

describe('buildSetBinderName', () => {
  it('joins username and uppercased set code with a dash', () => {
    expect(buildSetBinderName('mistercakes', 'wtr')).toBe('mistercakes - WTR');
  });

  it('strips internal OAuth-provisional prefixes from the username', () => {
    expect(buildSetBinderName('dc_bob', 'sea')).toBe('bob - SEA');
  });
});

describe('dedupeSetPrintings', () => {
  it('keeps one printing per card+foiling, preferring the non-art-variant printing', () => {
    const result = dedupeSetPrintings([
      p('aa-1', 'SEA001', 'r', ['AA']),
      p('reg-1', 'SEA001', 'r'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].printing_id).toBe('reg-1');
  });

  it('keeps distinct foilings of the same card as separate entries', () => {
    const result = dedupeSetPrintings([
      p('nf-1', 'SEA001', 's'),
      p('rf-1', 'SEA001', 'r'),
      p('cf-1', 'SEA001', 'c'),
    ]);
    expect(result.map(r => r.printing_id)).toEqual(['nf-1', 'rf-1', 'cf-1']);
  });

  it('keeps a card that only exists as an art variant', () => {
    const result = dedupeSetPrintings([p('aa-only', 'SEA002', 'r', ['AA'])]);
    expect(result.map(r => r.printing_id)).toEqual(['aa-only']);
  });

  it('keeps the first printing when duplicates tie (both regular)', () => {
    const result = dedupeSetPrintings([
      p('first', 'SEA003', 's'),
      p('second', 'SEA003', 's'),
    ]);
    expect(result.map(r => r.printing_id)).toEqual(['first']);
  });

  it('preserves input (collector number) order', () => {
    const result = dedupeSetPrintings([
      p('a', 'SEA001', 's'),
      p('b', 'SEA002', 's'),
      p('b-aa', 'SEA002', 's', ['AA']),
      p('c', 'SEA003', 's'),
    ]);
    expect(result.map(r => r.printing_id)).toEqual(['a', 'b', 'c']);
  });
});
