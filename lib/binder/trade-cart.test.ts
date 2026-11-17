import { describe, it, expect } from 'vitest';
import { toTradeCartEntry, mergeWantedIntoCart } from './trade-cart';

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
