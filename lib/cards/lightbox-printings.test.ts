import { describe, it, expect } from 'vitest';
import { buildPrintingRows } from './lightbox-printings';

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
