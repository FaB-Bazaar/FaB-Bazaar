import { describe, it, expect } from 'vitest';
import { toTradeCartEntry, mergeWantedIntoCart, tradeCartTotals, tradeCardDetails, tradeCardPriceLine } from './trade-cart';

const item = (id: string, quantity: number, extra: Record<string, unknown> = {}) => ({
  _id: id, printingId: `p-${id}`, quantity, display_name: `Card ${id}`, ...extra,
});

describe('toTradeCartEntry', () => {
  it('builds the cart shape the trade sidebar reads', () => {
    const entry = toTradeCartEntry(item('a', 4), 2);
    expect(entry).toMatchObject({
      id: 'a', quantity: 2, maxQuantity: 4, printingId: 'p-a', name: 'Card a', priority: 'medium', notes: '',
    });
  });

  it('never requests more than the binder holds', () => {
    expect(toTradeCartEntry(item('a', 1), 3).quantity).toBe(1);
  });
});

describe('mergeWantedIntoCart', () => {
  it('appends wanted items with their requested quantity', () => {
    const { cart, added } = mergeWantedIntoCart([], [{ ...item('a', 4), requestQuantity: 2 }]);
    expect(cart.map((c) => [c.id, c.quantity])).toEqual([['a', 2]]);
    expect(added).toBe(1);
  });

  it('keeps cards already in the cart and raises their quantity to the wanted amount', () => {
    const existing = [toTradeCartEntry(item('a', 4), 1), toTradeCartEntry(item('b', 2), 2)];
    const { cart, added } = mergeWantedIntoCart(existing, [
      { ...item('a', 4), requestQuantity: 3 },
      { ...item('b', 2), requestQuantity: 1 },
    ]);
    expect(cart.map((c) => [c.id, c.quantity])).toEqual([['a', 3], ['b', 2]]);
    expect(added).toBe(0);
  });
});

describe('tradeCartTotals', () => {
  it('sums copies and tcg_low × quantity from the binder card fields', () => {
    const cart = [
      toTradeCartEntry(item('a', 4, { tcg_low: 2.5 }), 2),
      toTradeCartEntry(item('b', 1, { tcg_low: 10 }), 1),
    ];
    expect(tradeCartTotals(cart)).toEqual({ copies: 3, value: 15, unpriced: 0 });
  });

  it('falls back to printingDetails.tcg_low, never tcg_market, and counts unpriced cards', () => {
    const cart = [
      { id: 'a', quantity: 1, printingDetails: { tcg_low: 4 } },
      { id: 'b', quantity: 2, tcg_market: 99 },
    ];
    expect(tradeCartTotals(cart)).toEqual({ copies: 3, value: 4, unpriced: 1 });
  });
});

describe('tradeCardDetails', () => {
  it('shows collector number and foiling, hiding non-foil', () => {
    expect(tradeCardDetails({ collector_number: 'IAR229', foiling: 'R' })).toBe('IAR229 · Rainbow Foil');
    expect(tradeCardDetails({ collector_number: 'IAR228', foiling: 'S' })).toBe('IAR228');
  });

  it('falls back to the set code when there is no collector number', () => {
    expect(tradeCardDetails({ set: 'wtr', foiling: 'C' })).toBe('WTR · Cold Foil');
  });
});

describe('tradeCardPriceLine', () => {
  it('shows tcg_low × quantity = line total', () => {
    expect(tradeCardPriceLine({ tcg_low: 22, quantity: 2 })).toBe('$22.00 × 2 = $44.00');
  });

  it('says so when the card has no price', () => {
    expect(tradeCardPriceLine({ quantity: 1, tcg_market: 5 })).toBe('No price');
  });
});
