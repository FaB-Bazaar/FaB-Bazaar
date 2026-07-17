import { describe, it, expect } from 'vitest';
import {
  parseLssPrintCode,
  guessArtVariations,
  pickSetPrints,
  buildProvisionalPrinting,
  buildProvisionalCard,
  naturalKeyOf,
} from './cardvault-ingest';

describe('parseLssPrintCode', () => {
  it('parses a plain English modern print', () => {
    expect(parseLssPrintCode('IAR159-MV')).toEqual({
      language: 'en', edition: 'n', collector: 'IAR159', suffix: 'MV',
    });
  });
  it('parses language prefixes (and jp → ja)', () => {
    expect(parseLssPrintCode('FR_IAR002').language).toBe('fr');
    expect(parseLssPrintCode('JA_AIO013').language).toBe('ja');
    expect(parseLssPrintCode('JP_AIO013').language).toBe('ja');
  });
  it('parses U- prefix as unlimited', () => {
    expect(parseLssPrintCode('U-ARC029-RF')).toEqual({
      language: 'en', edition: 'u', collector: 'ARC029', suffix: 'RF',
    });
  });
  it('no prefix on a first-edition-era set means 1st edition', () => {
    expect(parseLssPrintCode('ARC029', { setHasFirstEdition: true }).edition).toBe('f');
    expect(parseLssPrintCode('U-ARC029', { setHasFirstEdition: true }).edition).toBe('u');
  });
  it('no suffix → null suffix, collector is the whole code', () => {
    expect(parseLssPrintCode('1HP214')).toEqual({
      language: 'en', edition: 'n', collector: '1HP214', suffix: null,
    });
  });
});

describe('guessArtVariations', () => {
  it('marvels guess FA (every observed fab-cube marvel is {FA})', () => {
    expect(guessArtVariations('MV')).toEqual(['FA']);
  });
  it('EA guesses EA; plain foil suffixes and none guess empty', () => {
    expect(guessArtVariations('EA')).toEqual(['EA']);
    expect(guessArtVariations('RF')).toEqual([]);
    expect(guessArtVariations('CF')).toEqual([]);
    expect(guessArtVariations(null)).toEqual([]);
  });
});

describe('pickSetPrints', () => {
  const mk = (over: Record<string, unknown>) => ({
    id: 'uuid-' + Math.random().toString(36).slice(2),
    print_id: 'IAR159-MV',
    print_language: 'en',
    rarity: 'marvel',
    is_published: true,
    print_set: { set_code: 'IAR' },
    faces: [{ face_language: 'en', printed_code: 'IAR159', finish_type: 'cold-foil', art_type: 'extended-art', printed_name: 'X' }],
    ...over,
  });

  it('keeps only prints of the requested set and language', () => {
    const prints = [mk({}), mk({ print_id: 'FR_IAR159-MV', print_language: 'fr' }), mk({ print_set: { set_code: 'OMN' }, print_id: 'OMN001' })];
    const picked = pickSetPrints(prints, 'IAR', 'en');
    expect(picked.map((p) => p.print_id)).toEqual(['IAR159-MV']);
  });

  it('dedupes same print_id preferring published entries with a non-blank printed_code', () => {
    const junk = mk({ id: 'uuid-junk', is_published: false, faces: [{ face_language: 'en', printed_code: '', finish_type: 'cold-foil', art_type: 'regular', printed_name: '' }] });
    const good = mk({ id: 'uuid-good' });
    expect(pickSetPrints([junk, good], 'IAR', 'en').map((p) => p.id)).toEqual(['uuid-good']);
    expect(pickSetPrints([good, junk], 'IAR', 'en').map((p) => p.id)).toEqual(['uuid-good']);
  });
});

describe('buildProvisionalPrinting', () => {
  const print = {
    id: 'ae7768c1-uuid', print_id: 'IAR159-MV', print_language: 'en', rarity: 'marvel',
    is_published: true, print_set: { set_code: 'IAR' },
    faces: [{ face_language: 'en', printed_code: 'IAR159', finish_type: 'cold-foil', art_type: 'extended-art', printed_name: 'Baalghor, Omen of the End', image: { large: 'https://cv.example/IAR159.webp' } }],
  };

  it('builds a full provisional row with minted id and NULL fab-cube anchor', () => {
    const row = buildProvisionalPrinting(print as any, {
      printingId: 'minted123', cardUniqueId: 'card123',
    });
    expect(row).toMatchObject({
      printing_id: 'minted123',
      card_unique_id: 'card123',
      set: 'iar',
      collector_number: 'IAR159',
      edition: 'n',
      foiling: 'c',
      rarity: 'v',
      language: 'en',
      art_variations: ['FA'],
      is_cold_foil: true,
      fab_cube_printing_id: null,
      lss_print_id: 'ae7768c1-uuid',
      lss_print_code: 'IAR159-MV',
      image_url: 'https://cv.example/IAR159.webp',
    });
  });

  it('throws on unknown finish/rarity rather than guessing', () => {
    const bad = { ...print, rarity: 'mythic' };
    expect(() => buildProvisionalPrinting(bad as any, { printingId: 'x', cardUniqueId: 'y' })).toThrow(/rarity/i);
  });
});

describe('buildProvisionalCard', () => {
  const face = (over: Record<string, unknown>) => ({
    face_language: 'en', printed_name: 'X', printed_typebox: '', printed_rules_text: '',
    printed_pitch: null, printed_cost: '', printed_power: '', printed_defense: '',
    printed_intellect: '', printed_life: '', ...over,
  });

  it('derives hero flags and stats from a hero face', () => {
    const c = buildProvisionalCard(
      face({ printed_name: 'Viserai, the Forsaken', printed_typebox: 'Shadow Runeblade Hero', printed_intellect: '4', printed_life: '18' }),
      { cardUniqueId: 'c1', lssCardId: 'uuid1' },
    );
    expect(c).toMatchObject({
      card_unique_id: 'c1', lss_card_id: 'uuid1',
      display_name: 'Viserai, the Forsaken', name: 'viserai, the forsaken',
      is_hero: true, health: 18, intelligence: 4,
      has_shadow: true, is_runeblade: true,
      is_attack: false, pitch: null, cost: null,
      classes: ['runeblade'], talents: ['shadow'],
    });
  });

  it('derives attack-action flags and numeric stats', () => {
    const c = buildProvisionalCard(
      face({ printed_name: 'Beckoning Hunger', printed_typebox: 'Shadow Brute Action - Attack', printed_pitch: '1', printed_cost: '2', printed_power: '6', printed_defense: '2' }),
      { cardUniqueId: 'c2', lssCardId: 'uuid2' },
    );
    expect(c).toMatchObject({
      is_action: true, is_attack: true, is_brute: true, has_shadow: true, is_hero: false,
      pitch: 1, cost: 2, power: 6, defense: 2, health: null,
    });
  });

  it('derives weapon/class flags and defense reactions', () => {
    const w = buildProvisionalCard(
      face({ printed_name: 'Vox Necropolis', printed_typebox: 'Shadow Necromancer Weapon - Staff (2H)' }),
      { cardUniqueId: 'c3', lssCardId: 'uuid3' },
    );
    expect(w).toMatchObject({ is_weapon: true, is_necromancer: true, has_shadow: true });
    const dr = buildProvisionalCard(
      face({ printed_name: 'Some Block', printed_typebox: 'Guardian Defense Reaction', printed_pitch: '3', printed_defense: '4' }),
      { cardUniqueId: 'c4', lssCardId: 'uuid4' },
    );
    expect(dr).toMatchObject({ is_defense_reaction: true, is_guardian: true, defense: 4 });
  });

  it('blank printed stats become null, rules text is normalized lowercase', () => {
    const c = buildProvisionalCard(
      face({ printed_name: 'T', printed_rules_text: 'Go **again**{br}Draw a card.' }),
      { cardUniqueId: 'c5', lssCardId: 'uuid5' },
    );
    expect(c.cost).toBeNull();
    expect(c.power).toBeNull();
    expect(c.text).toBe('go again draw a card.');
  });
});

describe('naturalKeyOf', () => {
  it('matches the adoption tier-1 key (no art_variations, no rarity)', () => {
    expect(naturalKeyOf({ set: 'iar', collector_number: 'IAR159', edition: 'n', foiling: 'c', language: 'en' }))
      .toBe('iar|IAR159|n|c|en');
  });
});
