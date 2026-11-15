import { describe, it, expect } from 'vitest';
import { summarizeTrade } from './trade-summary';

describe('summarizeTrade', () => {
  it('totals for-trade cards and tcg_low value across binders', () => {
    const result = summarizeTrade([
      { quantityForTrade: 5, valueForTrade: { tcg_low: 28.85 } },
      { quantityForTrade: 10, valueForTrade: { tcg_low: 1.15 } },
    ]);
    expect(result).toEqual({ cardsForTrade: 15, valueForTrade: 30 });
  });

  it('counts cards from a binder that hides its value but leaves it out of the total', () => {
    const result = summarizeTrade([
      { quantityForTrade: 5, valueForTrade: { tcg_low: 20 } },
      { quantityForTrade: 7 },
    ]);
    expect(result).toEqual({ cardsForTrade: 12, valueForTrade: 20 });
  });

  it('reports no value at all when every binder hides its value', () => {
    expect(summarizeTrade([{ quantityForTrade: 3 }])).toEqual({ cardsForTrade: 3, valueForTrade: null });
  });

  it('is empty for a user with no binders', () => {
    expect(summarizeTrade([])).toEqual({ cardsForTrade: 0, valueForTrade: null });
  });
});
