/**
 * Pure-function tests for sortPrintings (no DB / no network).
 * The sort is used by /search to order results in both grouped and flat modes.
 */

import { describe, test, expect } from 'vitest';
import { sortPrintings, type BrowsePrinting } from './browse-cache';

// Minimal factory — only the fields the sort cares about (no Drizzle import).
function p(overrides: Partial<BrowsePrinting>): BrowsePrinting {
  return {
    printing_id: overrides.printing_id ?? 'p',
    card_unique_id: overrides.card_unique_id ?? 'c',
    display_name: overrides.display_name ?? null,
    type_text_display: null,
    color: null,
    image_url: null,
    collector_number: overrides.collector_number ?? null,
    types: null,
    pitch: overrides.pitch ?? null,
    power: overrides.power ?? null,
    cost: overrides.cost ?? null,
    defense: null,
    keywords: null,
    is_generic: false,
    is_guardian: false,
    is_warrior: false,
    is_ninja: false,
    is_wizard: false,
    is_brute: false,
    is_ranger: false,
    is_runeblade: false,
    is_necromancer: false,
    is_mechanologist: false,
    is_weapon: false,
    set: overrides.set ?? '',
    edition: overrides.edition ?? '',
    foiling: overrides.foiling ?? '',
    rarity: overrides.rarity ?? '',
    language: overrides.language ?? 'en',
    is_extended_art: false,
    art_variations: null,
    foil_inset_top: null,
    foil_inset_right: null,
    foil_inset_bottom: null,
    foil_inset_left: null,
    foil_inset_round: null,
  } as BrowsePrinting;
}

describe('sortPrintings — name sort secondary order', () => {
  test('cards with the same display_name tiebreak on pitch (1, 2, 3)', () => {
    const input = [
      p({ printing_id: 'p3', display_name: 'Angelic Descent', pitch: 3, collector_number: 'DTD034' }),
      p({ printing_id: 'p1', display_name: 'Angelic Descent', pitch: 1, collector_number: 'DTD032' }),
      p({ printing_id: 'p2', display_name: 'Angelic Descent', pitch: 2, collector_number: 'DTD033' }),
    ];
    const result = sortPrintings(input, 'name', 'asc');
    expect(result.map((x) => x.collector_number)).toEqual(['DTD032', 'DTD033', 'DTD034']);
  });

  test('pitch tiebreak preserves overall name ordering', () => {
    const input = [
      p({ printing_id: 'b3', display_name: 'B Card', pitch: 3 }),
      p({ printing_id: 'a2', display_name: 'A Card', pitch: 2 }),
      p({ printing_id: 'b1', display_name: 'B Card', pitch: 1 }),
      p({ printing_id: 'a1', display_name: 'A Card', pitch: 1 }),
    ];
    const result = sortPrintings(input, 'name', 'asc');
    expect(result.map((x) => x.printing_id)).toEqual(['a1', 'a2', 'b1', 'b3']);
  });

  test('cards with no pitch (heroes, equipment) tiebreak on collector_number', () => {
    const input = [
      p({ printing_id: 'b', display_name: 'Fyendal Spring Tunic', pitch: null, collector_number: 'WTR150' }),
      p({ printing_id: 'a', display_name: 'Fyendal Spring Tunic', pitch: null, collector_number: 'CRU178' }),
    ];
    const result = sortPrintings(input, 'name', 'asc');
    expect(result.map((x) => x.printing_id)).toEqual(['a', 'b']);
  });

  test('desc reverses both primary and secondary keys', () => {
    const input = [
      p({ printing_id: 'p1', display_name: 'Angelic Descent', pitch: 1 }),
      p({ printing_id: 'p2', display_name: 'Angelic Descent', pitch: 2 }),
      p({ printing_id: 'p3', display_name: 'Angelic Descent', pitch: 3 }),
    ];
    const result = sortPrintings(input, 'name', 'desc');
    expect(result.map((x) => x.printing_id)).toEqual(['p3', 'p2', 'p1']);
  });
});
