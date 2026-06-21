import { describe, it, expect } from 'vitest';
import { deriveForeignPrinting, foilingFlags } from './derive-foreign-printing';

describe('foilingFlags', () => {
  it('standard foil -> is_normal_foil', () => {
    expect(foilingFlags('s')).toEqual({ is_normal_foil: true, is_rainbow_foil: false, is_cold_foil: false });
  });
  it('rainbow foil -> is_rainbow_foil', () => {
    expect(foilingFlags('r')).toEqual({ is_normal_foil: false, is_rainbow_foil: true, is_cold_foil: false });
  });
  it('cold foil -> is_cold_foil', () => {
    expect(foilingFlags('c')).toEqual({ is_normal_foil: false, is_rainbow_foil: false, is_cold_foil: true });
  });
});

// Builds printings-row attributes for a foreign-language-exclusive printing
// (2HP / RAP) straight from the LSS CardVault print + face, since there is no
// English printing in the same set to mirror.

const scourFr2hp = {
  print: { print_language: 'fr', rarity: 'majestic', print_set: { set_code: '2HP' } },
  face: { printed_code: '2HP431', finish_type: 'regular', art_type: 'regular' },
};

describe('deriveForeignPrinting', () => {
  it('maps Scour 2HP431 (French, majestic, regular)', () => {
    const d = deriveForeignPrinting(scourFr2hp.print, scourFr2hp.face);
    expect(d).toMatchObject({
      set: '2hp',
      collector_number: '2HP431',
      language: 'fr',
      foiling: 's',
      rarity: 'm',
      edition: 'n',
      is_extended_art: false,
      is_normal_foil: true,
      is_rainbow_foil: false,
      is_cold_foil: false,
      is_majestic: true,
      is_common: false,
      is_rare: false,
      is_legendary: false,
      is_fabled: false,
      is_super_rare: false,
      is_promo: false,
    });
  });

  it('sets normal-edition flags for the n edition', () => {
    const d = deriveForeignPrinting(scourFr2hp.print, scourFr2hp.face);
    expect(d.edition).toBe('n');
    expect(d.is_normal_edition).toBe(true);
    expect(d.is_first_edition).toBe(false);
    expect(d.is_unlimited).toBe(false);
  });

  it('lowercases the set code and keeps the collector verbatim', () => {
    const d = deriveForeignPrinting(
      { print_language: 'ja', rarity: 'common', print_set: { set_code: 'RAP' } },
      { printed_code: 'RAP063', finish_type: 'regular', art_type: 'regular' },
    );
    expect(d.set).toBe('rap');
    expect(d.collector_number).toBe('RAP063');
    expect(d.language).toBe('ja');
    expect(d.is_common).toBe(true);
    expect(d.rarity).toBe('c');
  });

  it('maps rainbow-foil to r with the right flag', () => {
    const d = deriveForeignPrinting(
      { print_language: 'de', rarity: 'rare', print_set: { set_code: '2HP' } },
      { printed_code: '2HP010', finish_type: 'rainbow-foil', art_type: 'regular' },
    );
    expect(d.foiling).toBe('r');
    expect(d.is_rainbow_foil).toBe(true);
    expect(d.is_normal_foil).toBe(false);
    expect(d.rarity).toBe('r');
    expect(d.is_rare).toBe(true);
  });

  it('flags extended-art', () => {
    const d = deriveForeignPrinting(
      { print_language: 'it', rarity: 'legendary', print_set: { set_code: '2HP' } },
      { printed_code: '2HP200', finish_type: 'regular', art_type: 'extended-art' },
    );
    expect(d.is_extended_art).toBe(true);
    expect(d.is_legendary).toBe(true);
    expect(d.rarity).toBe('l');
  });

  it('maps fabled', () => {
    const d = deriveForeignPrinting(
      { print_language: 'es', rarity: 'fabled', print_set: { set_code: '2HP' } },
      { printed_code: '2HP005', finish_type: 'regular', art_type: 'regular' },
    );
    expect(d.rarity).toBe('f');
    expect(d.is_fabled).toBe(true);
  });

  it('maps a promo-marvel cold-foil hero to v / c (HER Marvel reprints)', () => {
    const d = deriveForeignPrinting(
      { print_language: 'en', rarity: 'promo-marvel', print_set: { set_code: 'HER' } },
      { printed_code: 'HER154', finish_type: 'cold-foil', art_type: 'regular' },
    );
    expect(d.set).toBe('her');
    expect(d.collector_number).toBe('HER154');
    expect(d.rarity).toBe('v');
    expect(d.foiling).toBe('c');
    expect(d.is_cold_foil).toBe(true);
    // Marvel is identified by rarity='v'; none of the boolean rarity flags apply.
    expect(d.is_promo).toBe(false);
    expect(d.is_majestic).toBe(false);
  });

  it('throws on an unknown rarity rather than guessing', () => {
    expect(() =>
      deriveForeignPrinting(
        { print_language: 'fr', rarity: 'mythic', print_set: { set_code: '2HP' } },
        { printed_code: '2HP999', finish_type: 'regular', art_type: 'regular' },
      ),
    ).toThrow(/rarity/i);
  });

  it('throws on an unknown finish_type rather than guessing', () => {
    expect(() =>
      deriveForeignPrinting(
        { print_language: 'fr', rarity: 'common', print_set: { set_code: '2HP' } },
        { printed_code: '2HP998', finish_type: 'holographic', art_type: 'regular' },
      ),
    ).toThrow(/finish/i);
  });
});
