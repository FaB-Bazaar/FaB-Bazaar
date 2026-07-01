import { describe, it, expect } from 'vitest';
import { normalizeCondition, CONDITION_CODES } from './card-condition';

describe('normalizeCondition', () => {
  it('passes through valid enum codes', () => {
    for (const code of CONDITION_CODES) {
      expect(normalizeCondition(code)).toBe(code);
    }
  });

  it('is case-insensitive for codes', () => {
    expect(normalizeCondition('nm')).toBe('NM');
    expect(normalizeCondition('dmg')).toBe('DMG');
  });

  it('maps human-readable labels to enum codes', () => {
    expect(normalizeCondition('Near Mint')).toBe('NM');
    expect(normalizeCondition('Lightly Played')).toBe('LP');
    expect(normalizeCondition('Moderately Played')).toBe('MP');
    expect(normalizeCondition('Heavily Played')).toBe('HP');
    expect(normalizeCondition('Damaged')).toBe('DMG');
  });

  it('tolerates label casing and surrounding whitespace', () => {
    expect(normalizeCondition('  near mint ')).toBe('NM');
    expect(normalizeCondition('LIGHTLY PLAYED')).toBe('LP');
  });

  it('defaults empty / missing input to NM', () => {
    expect(normalizeCondition(undefined)).toBe('NM');
    expect(normalizeCondition('')).toBe('NM');
    expect(normalizeCondition('   ')).toBe('NM');
  });

  it('returns null for unrecognized values', () => {
    expect(normalizeCondition('Pristine')).toBeNull();
    expect(normalizeCondition('garbage')).toBeNull();
  });
});
