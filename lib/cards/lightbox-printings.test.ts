import { describe, it, expect } from 'vitest';
import { buildPrintingRows, groupPrintingRows } from './lightbox-printings';

const base = {
  card_unique_id: 'card1', name: 'Ancestral Harmony', collector_number: 'HVY247', set: 'hvy',
  edition: 'n', rarity: 'm', language: 'en', tcg_market: 99, art_variations: [] as string[],
};

describe('buildPrintingRows', () => {
  it('keeps English printings only, in canonical order, labelled and priced with tcg_low', () => {
    const { rows, otherLanguages } = buildPrintingRows([
      { ...base, printing_id: 'rf', foiling: 'r', tcg_low: 10, tcgplayer_url: 'https://www.tcgplayer.com/product/533633?Language=English&Printing=Rainbow+Foil' },
      { ...base, printing_id: 'ja', foiling: 's', language: 'ja', tcg_low: null },
      { ...base, printing_id: 'nf', foiling: 's', tcg_low: 7.77, tcgplayer_url: 'https://www.tcgplayer.com/product/533633?Language=English&Printing=Normal' },
      { ...base, printing_id: 'fr', foiling: 'r', language: 'fr', tcg_low: null },
    ], 'nf');

    expect(otherLanguages).toBe(2);
    expect(rows.map(r => r.printing_id)).toEqual(['nf', 'rf']);
    expect(rows[0]).toMatchObject({
      collector: 'HVY247', setName: 'Heavy Hitters', rarity: 'Majestic', foiling: 'Non-foil',
      year: '2024', price: 7.77, isCurrent: true,
      tcgplayerUrl: 'https://www.tcgplayer.com/product/533633?Language=English&Printing=Normal',
    });
    expect(rows[1]).toMatchObject({ foiling: 'Rainbow Foil', price: 10, isCurrent: false });
  });

  it('labels editions and art variations, and reports a missing price as null (never tcg_market)', () => {
    const { rows } = buildPrintingRows([
      { ...base, printing_id: 'a', set: 'wtr', edition: 'f', foiling: 's', art_variations: ['AA'], tcg_low: null },
    ], 'zzz');
    expect(rows[0]).toMatchObject({ setName: 'Welcome to Rathe', edition: 'First Edition', artVariation: 'Alternate Art', price: null, isCurrent: false });
  });

  it('treats a missing language as English', () => {
    const { rows, otherLanguages } = buildPrintingRows([{ ...base, printing_id: 'x', foiling: 's', language: undefined }], 'x');
    expect(rows).toHaveLength(1);
    expect(otherLanguages).toBe(0);
  });
});

describe('groupPrintingRows', () => {
  it('groups by collector number + set + edition + art variation, foilings as variants in canonical order', () => {
    const { rows } = buildPrintingRows([
      { ...base, printing_id: 'rf', foiling: 'r', tcg_low: 10 },
      { ...base, printing_id: 'nf', foiling: 's', tcg_low: 7.77 },
      { ...base, printing_id: 'aa', foiling: 'r', art_variations: ['AA'], tcg_low: 50 },
      { ...base, printing_id: 'sly', set: 'sly', collector_number: 'SLY020', foiling: 's', tcg_low: null },
    ], 'rf');
    const groups = groupPrintingRows(rows);
    expect(groups.map(g => [g.collector, g.artVariation, g.variants.map(v => v.printing_id)])).toEqual([
      ['HVY247', null, ['nf', 'rf']],
      ['HVY247', 'Alternate Art', ['aa']],
      ['SLY020', null, ['sly']],
    ]);
    expect(groups[0]).toMatchObject({ setName: 'Heavy Hitters', year: '2024', edition: 'Normal' });
    expect(groups[0].variants[1]).toMatchObject({ foilCode: 'r', foiling: 'Rainbow Foil', price: 10, isCurrent: true });
    expect(groups[2].variants[0]).toMatchObject({ foilCode: 's', price: null, isCurrent: false });
  });

  it('keeps a first-edition and an unlimited printing of the same collector number apart (WTR canonical order: Unlimited first)', () => {
    const { rows } = buildPrintingRows([
      { ...base, printing_id: 'f', set: 'wtr', collector_number: 'WTR001', edition: 'f', foiling: 's', tcg_low: 1 },
      { ...base, printing_id: 'u', set: 'wtr', collector_number: 'WTR001', edition: 'u', foiling: 's', tcg_low: 2 },
    ], 'f');
    expect(groupPrintingRows(rows).map(g => g.edition)).toEqual(['Unlimited', 'First Edition']);
  });

  it('flags the cheapest priced variant across all groups', () => {
    const { rows } = buildPrintingRows([
      { ...base, printing_id: 'a', foiling: 'r', tcg_low: 10 },
      { ...base, printing_id: 'b', set: 'sly', collector_number: 'SLY020', foiling: 's', tcg_low: 0.3 },
      { ...base, printing_id: 'c', set: 'sup', collector_number: 'SUP091', foiling: 's', tcg_low: null },
    ], 'a');
    const flat = groupPrintingRows(rows).flatMap(g => g.variants);
    expect(flat.filter(v => v.isCheapest).map(v => v.printing_id)).toEqual(['b']);
  });
});
