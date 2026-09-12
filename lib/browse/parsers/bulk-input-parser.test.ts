// lib/browse/parsers/bulk-input-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseBulkInput } from './bulk-input-parser';

describe('parseBulkInput — cardlist loose color handling', () => {
  it('strips a trailing color word but records the full name as fallbackName', () => {
    // "Deep Blue" is Generic Equipment (no pitch). The loose suffix parser will
    // read "Blue" as a pitch color, so we must remember the full name to retry.
    const [card] = parseBulkInput('Deep Blue', 'cardlist');

    expect(card.name).toBe('deep');
    expect(card.color).toBe('blue');
    expect(card.fallbackName).toBe('deep blue');
  });

  it('strips a leading color word but records the full name as fallbackName', () => {
    const [card] = parseBulkInput('Blue Lightning', 'cardlist');

    expect(card.name).toBe('lightning');
    expect(card.color).toBe('blue');
    expect(card.fallbackName).toBe('blue lightning');
  });

  it('does not set fallbackName when no loose color was stripped', () => {
    const [card] = parseBulkInput('Command and Conquer', 'cardlist');

    expect(card.name).toBe('command and conquer');
    expect(card.color).toBe('');
    expect(card.fallbackName).toBeUndefined();
  });

  it('does not set fallbackName when color comes from explicit parenthesis syntax', () => {
    // Explicit "(blue)" is authoritative — the user meant the blue pitch.
    const [card] = parseBulkInput('Sink Below (blue)', 'cardlist');

    expect(card.name).toBe('sink below');
    expect(card.color).toBe('blue');
    expect(card.fallbackName).toBeUndefined();
  });

  it('preserves the partial-match wildcard while recording fallbackName', () => {
    const [card] = parseBulkInput('*Deep Blue', 'cardlist');

    expect(card.name).toBe('deep');
    expect(card.color).toBe('blue');
    expect(card.isPartialMatch).toBe(true);
    expect(card.fallbackName).toBe('deep blue');
  });
});

describe('parseBulkInput — cardlist collector numbers', () => {
  it('reads "2 WTR001" as quantity 2 of collector number WTR001', () => {
    const [card] = parseBulkInput('2 WTR001', 'cardlist');

    expect(card.quantity).toBe(2);
    expect(card.collectorNumber).toBe('WTR001');
    expect(card.color).toBe('');
    expect(card.fallbackName).toBeUndefined();
  });

  it('uppercases a lowercase collector number and accepts the "4x" quantity form', () => {
    const [card] = parseBulkInput('4x arc057', 'cardlist');

    expect(card.quantity).toBe(4);
    expect(card.collectorNumber).toBe('ARC057');
  });

  it('keeps a bare digit-leading collector number (1HP001) intact instead of eating the 1 as a quantity', () => {
    const [card] = parseBulkInput('1HP001', 'cardlist');

    expect(card.quantity).toBe(1);
    expect(card.collectorNumber).toBe('1HP001');
  });

  it('still honours parenthesised foiling/edition tags after a collector number', () => {
    const [card] = parseBulkInput('3 WTR001 (RF, 1st)', 'cardlist');

    expect(card.quantity).toBe(3);
    expect(card.collectorNumber).toBe('WTR001');
    expect(card.foiling).toBe('r');
    expect(card.edition).toBe('f');
  });

  it('does not treat ordinary names as collector numbers', () => {
    const cards = parseBulkInput('Command and Conquer\nSnatch\n2 Sink Below red', 'cardlist');

    expect(cards.map(c => c.collectorNumber)).toEqual([undefined, undefined, undefined]);
    expect(cards[2].name).toBe('sink below');
  });
});

describe('parseBulkInput — bare tags after a collector number', () => {
  it('reads "1 WTR123 RF" as collector WTR123 with rainbow foiling', () => {
    const [card] = parseBulkInput('1 WTR123 RF', 'cardlist');

    expect(card.quantity).toBe(1);
    expect(card.collectorNumber).toBe('WTR123');
    expect(card.foiling).toBe('r');
  });

  it('accepts several bare tags, including two-word ones and editions', () => {
    const [card] = parseBulkInput('2 arc057 cold foil 1st', 'cardlist');

    expect(card.collectorNumber).toBe('ARC057');
    expect(card.foiling).toBe('c');
    expect(card.edition).toBe('f');
  });

  it('declines the collector reading when a trailing token is not a known tag', () => {
    const [card] = parseBulkInput('WTR123 something', 'cardlist');

    expect(card.collectorNumber).toBeUndefined();
    expect(card.name).toBe('wtr123 something');
  });
});
