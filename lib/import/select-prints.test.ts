import { describe, it, expect } from 'vitest';
import { selectPrintsForImport } from './select-prints';

const prints = [
  { print_language: 'de', print_set: { set_code: '2HP' } },
  { print_language: 'fr', print_set: { set_code: '2HP' } },
  { print_language: 'de', print_set: { set_code: 'DTD' } },
  { print_language: 'en', print_set: { set_code: 'MON' } },
  { print_language: 'de', print_set: { set_code: 'dtd' } }, // lowercase set_code
];

describe('selectPrintsForImport', () => {
  it('filters by language when no set filter is given', () => {
    const r = selectPrintsForImport(prints, 'de', null);
    expect(r).toHaveLength(3); // 2HP de, DTD de, dtd de
  });

  it('narrows to a single set (case-insensitive) on top of language', () => {
    const r = selectPrintsForImport(prints, 'de', '2hp');
    expect(r).toHaveLength(1);
    expect(r[0].print_set.set_code).toBe('2HP');
  });

  it('excludes other sets even when they share the language — the scoping guard', () => {
    const r = selectPrintsForImport(prints, 'de', '2hp');
    expect(r.some((p) => p.print_set.set_code.toLowerCase() === 'dtd')).toBe(false);
  });

  it('matches a lowercase set_code against the filter', () => {
    const r = selectPrintsForImport(prints, 'de', 'dtd');
    expect(r).toHaveLength(2); // both 'DTD' and 'dtd'
  });

  it('returns empty when the set has no print in that language', () => {
    expect(selectPrintsForImport(prints, 'ja', '2hp')).toHaveLength(0);
  });
});
