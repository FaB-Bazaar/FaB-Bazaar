// lib/deck/import-url-params.test.ts
//
// URL-query-string deck import (FaBrary-compatible): ?name=&format=&hero=&cards=
// where `cards` is a comma-separated list of kebab-case card slugs with an
// optional pitch-color suffix (-red/-yellow/-blue), repeated once per copy.

import { describe, test, expect } from 'vitest';
import { parseImportUrlParams, slugToTalisharId, synthesizeFabraryText } from './import-url-params';
import { parseFabraryDeck } from '@/lib/browse/parsers/fabrary-deck-parser';

// Trimmed-down version of a real FaBrary share URL's query string.
const SAMPLE = new URLSearchParams(
  'name=FABtastic+-+Arakni%2C+Marionette&format=Classic+Constructed&hero=arakni-marionette' +
  '&cards=arakni-marionette%2Chunters-klaive%2Chunters-klaive%2Cmask-of-deceit' +
  '%2Ckiss-of-death-red%2Ckiss-of-death-red%2Ckiss-of-death-red%2Cshred-blue%2Cshred-blue',
);

describe('parseImportUrlParams', () => {
  test('extracts name, canonical format, and hero slug', () => {
    const req = parseImportUrlParams(SAMPLE);
    expect(req.name).toBe('FABtastic - Arakni, Marionette');
    expect(req.format).toBe('Classic Constructed');
    expect(req.heroSlug).toBe('arakni-marionette');
  });

  test('dedupes repeated card slugs into quantities, preserving first-seen order', () => {
    const req = parseImportUrlParams(SAMPLE);
    expect(req.cards).toEqual([
      { slug: 'hunters-klaive', talisharId: 'hunters_klaive', quantity: 2 },
      { slug: 'mask-of-deceit', talisharId: 'mask_of_deceit', quantity: 1 },
      { slug: 'kiss-of-death-red', talisharId: 'kiss_of_death_red', quantity: 3 },
      { slug: 'shred-blue', talisharId: 'shred_blue', quantity: 2 },
    ]);
  });

  test('excludes the hero slug from the card list (FaBrary lists the hero as a card)', () => {
    const req = parseImportUrlParams(SAMPLE);
    expect(req.cards.some(c => c.slug === 'arakni-marionette')).toBe(false);
  });

  test('resolves format aliases and rejects unknown formats', () => {
    const fmt = (s: string) => parseImportUrlParams(new URLSearchParams({ format: s })).format;
    expect(fmt('cc')).toBe('Classic Constructed');
    expect(fmt('blitz')).toBe('Blitz');
    expect(fmt('sage')).toBe('Silver Age');
    expect(fmt('silver age')).toBe('Silver Age');
    expect(fmt('commoner')).toBe('Commoner');
    expect(fmt('CLASSIC CONSTRUCTED')).toBe('Classic Constructed');
    expect(fmt('pauper')).toBeNull();
    expect(fmt('')).toBeNull();
  });

  test('handles absent params: empty name, null format, empty hero and cards', () => {
    const req = parseImportUrlParams(new URLSearchParams());
    expect(req.name).toBe('');
    expect(req.format).toBeNull();
    expect(req.heroSlug).toBe('');
    expect(req.cards).toEqual([]);
  });

  test('ignores empty slugs from stray commas', () => {
    const req = parseImportUrlParams(new URLSearchParams({ cards: ',shred-blue,,shred-blue,' }));
    expect(req.cards).toEqual([{ slug: 'shred-blue', talisharId: 'shred_blue', quantity: 2 }]);
  });
});

describe('raw talishar-id card tokens', () => {
  test('passes snake_case talishar ids through unchanged', () => {
    const req = parseImportUrlParams(new URLSearchParams({ cards: 'kiss_of_death_red,kiss_of_death_red' }));
    expect(req.cards).toEqual([
      { slug: 'kiss_of_death_red', talisharId: 'kiss_of_death_red', quantity: 2 },
    ]);
  });

  test('preserves the DFC double underscore (comet_storm__shock_red)', () => {
    const req = parseImportUrlParams(new URLSearchParams({ cards: 'comet_storm__shock_red' }));
    expect(req.cards[0].talisharId).toBe('comet_storm__shock_red');
  });

  test('mixes kebab slugs and talishar ids in one list', () => {
    const req = parseImportUrlParams(new URLSearchParams({ cards: 'shred-blue,comet_storm__shock_red,shred-blue' }));
    expect(req.cards.map(c => c.talisharId)).toEqual(['shred_blue', 'comet_storm__shock_red']);
    expect(req.cards[0].quantity).toBe(2);
  });
});

describe('inventory param', () => {
  test('parses inventory= with the same repeat-per-copy dedupe as cards=', () => {
    const req = parseImportUrlParams(new URLSearchParams(
      'cards=shred-blue&inventory=fate_foreseen_red,fate_foreseen_red,codex_of_frailty_yellow',
    ));
    expect(req.inventory).toEqual([
      { slug: 'fate_foreseen_red', talisharId: 'fate_foreseen_red', quantity: 2 },
      { slug: 'codex_of_frailty_yellow', talisharId: 'codex_of_frailty_yellow', quantity: 1 },
    ]);
    expect(req.cards).toHaveLength(1);
  });

  test('defaults to an empty inventory when the param is absent', () => {
    expect(parseImportUrlParams(new URLSearchParams()).inventory).toEqual([]);
  });
});

describe('slugToTalisharId', () => {
  test('maps kebab-case to snake_case', () => {
    expect(slugToTalisharId('art-of-desire-body-red')).toBe('art_of_desire_body_red');
    expect(slugToTalisharId('hunters-klaive')).toBe('hunters_klaive');
  });

  test('keeps digits and lowercases', () => {
    expect(slugToTalisharId('Hyper-X2')).toBe('hyper_x2');
  });

  test('drops characters that never appear in talishar ids', () => {
    expect(slugToTalisharId("hunter's-klaive!")).toBe('hunters_klaive');
  });
});

describe('synthesizeFabraryText', () => {
  const input = {
    name: 'FABtastic - Arakni, Marionette',
    format: 'Classic Constructed',
    heroName: 'Arakni, Marionette',
    cards: [
      { displayName: "Hunter's Klaive", pitch: null, quantity: 2 },
      { displayName: 'Kiss of Death', pitch: 1, quantity: 3 },
      { displayName: 'Codex of Frailty', pitch: 2, quantity: 3 },
      { displayName: 'Shred', pitch: 3, quantity: 2 },
    ],
  };

  test('round-trips through parseFabraryDeck with headers intact', () => {
    const parsed = parseFabraryDeck(synthesizeFabraryText(input));
    expect(parsed.name).toBe('FABtastic - Arakni, Marionette');
    expect(parsed.heroName).toBe('Arakni, Marionette');
    expect(parsed.format).toBe('Classic Constructed');
  });

  test('round-trips card names, quantities, and pitch colors', () => {
    const parsed = parseFabraryDeck(synthesizeFabraryText(input));
    expect(parsed.cards).toHaveLength(4);
    expect(parsed.cards[0]).toMatchObject({ name: "hunter's klaive", quantity: 2, color: '' });
    expect(parsed.cards[1]).toMatchObject({ name: 'kiss of death', quantity: 3, color: 'red' });
    expect(parsed.cards[2]).toMatchObject({ name: 'codex of frailty', quantity: 3, color: 'yellow' });
    expect(parsed.cards[3]).toMatchObject({ name: 'shred', quantity: 2, color: 'blue' });
  });
});

describe('Future Classic Constructed via URL import', () => {
  test('accepts the format and its aliases', () => {
    const fmt = (s: string) => parseImportUrlParams(new URLSearchParams({ format: s })).format;
    expect(fmt('Future Classic Constructed')).toBe('Future Classic Constructed');
    expect(fmt('fcc')).toBe('Future Classic Constructed');
    expect(fmt('future cc')).toBe('Future Classic Constructed');
  });
});
