import { describe, it, expect } from 'vitest';
import { HERO_CLASSES, resolveClassShorthand } from './classes';

// `c:mechanologist` works but `c:mech` doesn't — resolveClassShorthand turns
// aliases and unambiguous prefixes into the canonical class name the DB stores.
describe('resolveClassShorthand', () => {
  it('returns canonical classes unchanged (case-insensitive)', () => {
    for (const c of HERO_CLASSES) expect(resolveClassShorthand(c)).toBe(c);
    expect(resolveClassShorthand('Guardian')).toBe('guardian');
    expect(resolveClassShorthand('generic')).toBe('generic');
  });

  it('resolves curated aliases', () => {
    expect(resolveClassShorthand('mech')).toBe('mechanologist');
    expect(resolveClassShorthand('rb')).toBe('runeblade');
    expect(resolveClassShorthand('illu')).toBe('illusionist');
    expect(resolveClassShorthand('necro')).toBe('necromancer');
    expect(resolveClassShorthand('wiz')).toBe('wizard');
    expect(resolveClassShorthand('gen')).toBe('generic');
  });

  it('resolves any unambiguous prefix of 2+ letters', () => {
    expect(resolveClassShorthand('mecha')).toBe('mechanologist');
    expect(resolveClassShorthand('gu')).toBe('guardian');
    expect(resolveClassShorthand('run')).toBe('runeblade');
    expect(resolveClassShorthand('wa')).toBe('warrior');
    expect(resolveClassShorthand('shape')).toBe('shapeshifter');
  });

  it('every two-letter prefix resolves; me is a curated alias for mechanologist (mer = merchant)', () => {
    for (const c of HERO_CLASSES) if (c !== 'merchant') expect(resolveClassShorthand(c.slice(0, 2))).toBe(c);
    expect(resolveClassShorthand('me')).toBe('mechanologist');
    expect(resolveClassShorthand('mer')).toBe('merchant');
  });

  it('returns null for ambiguous single letters (w = warrior|wizard)', () => {
    expect(resolveClassShorthand('w')).toBeNull();
    expect(resolveClassShorthand('ge')).toBe('generic');
    expect(resolveClassShorthand('g')).toBeNull();
  });

  it('returns null for unknown input and blanks', () => {
    expect(resolveClassShorthand('dragon')).toBeNull();
    expect(resolveClassShorthand('')).toBeNull();
    expect(resolveClassShorthand('   ')).toBeNull();
  });
});
