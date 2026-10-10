import { describe, it, expect } from 'vitest';
import { ordinal, metaFormats, summarizeMeta, shortFormat } from './decks-to-beat-meta';
import type { CardDecksToBeatEntryDTO } from '@/lib/services/contracts/IDeckService';

const deck = (heroName: string, format: string, placing?: number): CardDecksToBeatEntryDTO => ({
  publicId: `${heroName}-${placing}`, name: heroName, heroName, format, placing, quantity: 1,
});

// Authority of Ataya's real Decks to Beat (prod, 2026-10-10).
const DECKS = [
  deck('Marlynn, Treasure Hunter', 'Classic Constructed', 5),
  deck('Dorinthea Ironsong', 'Classic Constructed', 3),
  deck('Dorinthea Ironsong', 'Classic Constructed', 5),
  deck('Valda', 'Classic Constructed', 3),
  deck('Kassai', 'Classic Constructed', 5),
  deck('Marlynn, Treasure Hunter', 'Living Legend', 3),
];
const TOTALS = { 'Classic Constructed': 256, 'Silver Age': 84, 'Living Legend': 16 };

describe('ordinal', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [102, '102nd']])(
    '%i → %s', (n, expected) => { expect(ordinal(n)).toBe(expected); },
  );
});

describe('shortFormat', () => {
  it('abbreviates known formats and passes unknown ones through', () => {
    expect(shortFormat('Classic Constructed')).toBe('CC');
    expect(shortFormat('Living Legend')).toBe('LL');
    expect(shortFormat('Silver Age')).toBe('SA');
    expect(shortFormat('Draft')).toBe('Draft');
  });
});

describe('metaFormats', () => {
  it('lists only formats the card is played in, most decks first', () => {
    expect(metaFormats(DECKS)).toEqual(['Classic Constructed', 'Living Legend']);
  });

  it('ignores decks with no format', () => {
    expect(metaFormats([{ ...deck('X', 'Blitz'), format: undefined }])).toEqual([]);
  });
});

describe('summarizeMeta', () => {
  it('summarises one format: share of all Decks to Beat, heroes by count, best finish', () => {
    expect(summarizeMeta(DECKS, TOTALS, 'Classic Constructed')).toEqual({
      deckCount: 5,
      total: 256,
      bestPlacing: 3,
      heroes: [
        { heroName: 'Dorinthea Ironsong', count: 2 },
        { heroName: 'Kassai', count: 1 },
        { heroName: 'Marlynn, Treasure Hunter', count: 1 },
        { heroName: 'Valda', count: 1 },
      ],
    });
  });

  it('has no best finish when no deck in the format is placed', () => {
    const s = summarizeMeta([deck('Valda', 'Blitz')], { Blitz: 10 }, 'Blitz');
    expect(s.bestPlacing).toBeUndefined();
    expect(s.total).toBe(10);
  });

  it('groups decks without a hero under "Unknown hero"', () => {
    const s = summarizeMeta([{ ...deck('X', 'Blitz'), heroName: undefined }], {}, 'Blitz');
    expect(s.heroes).toEqual([{ heroName: 'Unknown hero', count: 1 }]);
    expect(s.total).toBe(0);
  });
});
