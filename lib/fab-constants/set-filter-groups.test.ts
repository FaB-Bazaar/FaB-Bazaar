// lib/fab-constants/set-filter-groups.test.ts
//
// Pins the /opt set-filter vocabulary: the individually-selectable promo and
// standalone-product set codes, and the derived deck-product groups (Blitz /
// Armory / Silver Age / Hero decks) whose membership comes from SET_METADATA —
// a new deck added to the `sets` table joins its group on regeneration, with
// no code edit.

import { describe, it, expect } from 'vitest';
import {
  SET_METADATA,
  PROMO_FILTER_SETS,
  OTHER_PRODUCT_FILTER_SETS,
  SET_FILTER_GROUPS,
  isSetGroupToken,
  expandSetSelections,
} from './sets';

describe('promo & standalone-product filter sets', () => {
  it('lists the nine individually-selectable promo sets', () => {
    expect(PROMO_FILTER_SETS).toEqual([
      'lgs', 'fab', 'her', 'gem', 'jdg', 'win', 'lss', 'tnp', 'oxo',
    ]);
  });

  it('lists the standalone products (Classic Battles, 1st Strike, TCC, Smash Palace)', () => {
    expect(OTHER_PRODUCT_FILTER_SETS).toEqual(['dvr', 'rvd', 'aur', 'ter', 'tcc', 'smp']);
  });

  it('every listed code is known to SET_METADATA (labels and logos resolve)', () => {
    for (const code of [...PROMO_FILTER_SETS, ...OTHER_PRODUCT_FILTER_SETS]) {
      expect(SET_METADATA[code], code).toBeDefined();
    }
  });
});

describe('SET_FILTER_GROUPS — derived deck-product groups', () => {
  it('exposes the four groups with stable tokens and labels', () => {
    expect(SET_FILTER_GROUPS.map(g => [g.token, g.label])).toEqual([
      ['grp:blitz', 'Blitz Decks'],
      ['grp:armory', 'Armory Decks'],
      ['grp:silver-age', 'Silver Age Decks'],
      ['grp:hero-decks', 'Hero Decks'],
    ]);
  });

  it('derives membership from SET_METADATA (spot checks incl. Historic Pack blitz)', () => {
    const byToken = Object.fromEntries(SET_FILTER_GROUPS.map(g => [g.token, g.codes]));
    expect(byToken['grp:blitz']).toEqual(expect.arrayContaining(['bol', 'fai', '1hb', 'wod']));
    expect(byToken['grp:armory']).toEqual(expect.arrayContaining(['ako', 'aaz', 'apr']));
    expect(byToken['grp:silver-age']).toEqual(expect.arrayContaining(['sar', 'svi']));
    expect(byToken['grp:hero-decks']).toEqual(['bvo', 'ksu', 'rnr', 'tea']);
  });

  it('groups are non-empty, disjoint, and never contain standard sets', () => {
    const seen = new Set<string>();
    for (const g of SET_FILTER_GROUPS) {
      expect(g.codes.length, g.token).toBeGreaterThan(0);
      for (const code of g.codes) {
        expect(seen.has(code), `${code} appears in two groups`).toBe(false);
        seen.add(code);
        expect(SET_METADATA[code]?.category, code).not.toBe('standard');
      }
    }
  });
});

describe('isSetGroupToken', () => {
  it('recognizes group tokens and rejects plain set codes', () => {
    expect(isSetGroupToken('grp:blitz')).toBe(true);
    expect(isSetGroupToken('wtr')).toBe(false);
    expect(isSetGroupToken('gem')).toBe(false);
  });
});

describe('expandSetSelections', () => {
  it('passes plain set codes through unchanged', () => {
    expect(expandSetSelections(['wtr', 'gem'])).toEqual(['wtr', 'gem']);
  });

  it('expands a group token into its member codes, in place', () => {
    expect(expandSetSelections(['wtr', 'grp:hero-decks', 'lgs'])).toEqual([
      'wtr', 'bvo', 'ksu', 'rnr', 'tea', 'lgs',
    ]);
  });

  it('dedupes overlap between an expanded group and an explicit code', () => {
    expect(expandSetSelections(['bvo', 'grp:hero-decks'])).toEqual([
      'bvo', 'ksu', 'rnr', 'tea',
    ]);
  });

  it('drops unknown group tokens rather than sending them to the server', () => {
    expect(expandSetSelections(['grp:nope', 'wtr'])).toEqual(['wtr']);
  });
});
