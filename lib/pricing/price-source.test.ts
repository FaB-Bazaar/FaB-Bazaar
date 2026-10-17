import { describe, it, expect } from 'vitest';
import { cardPrice, formatPrice, sortForSource, binderValue } from './price-source';

describe('cardPrice', () => {
  const card = { tcg_low: 0.25, tcg_market: 0.4, cardmarket_price: 0.22 };

  it('is tcg_low for TCGplayer viewers', () => {
    expect(cardPrice(card, 'tcgplayer')).toBe(0.25);
  });

  it('is the Cardmarket price for Cardmarket viewers', () => {
    expect(cardPrice(card, 'cardmarket')).toBe(0.22);
  });

  it('never falls back to the other source', () => {
    expect(cardPrice({ tcg_low: 0.25 }, 'cardmarket')).toBeUndefined();
    expect(cardPrice({ cardmarket_price: 0.22 }, 'tcgplayer')).toBeUndefined();
  });
});

describe('formatPrice', () => {
  it('uses $ for TCGplayer and € for Cardmarket', () => {
    expect(formatPrice(1234.5, 'tcgplayer')).toBe('$1,234.50');
    expect(formatPrice(1234.5, 'cardmarket')).toBe('€1,234.50');
  });
});

describe('sortForSource', () => {
  it('swaps a price sort to the viewer source, keeping the direction', () => {
    expect(sortForSource('tcg-low-desc', 'cardmarket')).toBe('cardmarket-desc');
    expect(sortForSource('tcg-low-asc', 'cardmarket')).toBe('cardmarket-asc');
    expect(sortForSource('cardmarket-desc', 'tcgplayer')).toBe('tcg-low-desc');
  });

  it('leaves non-price sorts alone', () => {
    expect(sortForSource('name', 'cardmarket')).toBe('name');
    expect(sortForSource('tcg-market-desc', 'cardmarket')).toBe('tcg-market-desc');
  });
});

describe('binderValue', () => {
  it('is the TCG Low total or the € total', () => {
    const totalValue = { tcg_low: 10, tcg_market: 12, cardmarket: 8 };
    expect(binderValue(totalValue, 'tcgplayer')).toBe(10);
    expect(binderValue(totalValue, 'cardmarket')).toBe(8);
    expect(binderValue(undefined, 'cardmarket')).toBe(0);
  });
});
