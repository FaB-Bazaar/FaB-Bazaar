import { describe, it, expect } from 'vitest';
import { loadTradeCart, saveTradeCart, tradeCartKey, TRADE_CART_TTL_MS } from './trade-cart-storage';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

const card = (id: string, quantity = 1) => ({ id, quantity, maxQuantity: 4, name: id });
const NOW = 1_700_000_000_000;

describe('trade cart storage', () => {
  it('round-trips the cart for the same viewer and binder', () => {
    const s = memoryStorage();
    saveTradeCart(s, 'viewer', 'binder', [card('a', 2)], NOW);
    expect(loadTradeCart(s, 'viewer', 'binder', NOW + 1000)).toEqual([card('a', 2)]);
  });

  it('keeps carts separate per binder and per viewer', () => {
    const s = memoryStorage();
    saveTradeCart(s, 'viewer', 'b1', [card('a')], NOW);
    expect(loadTradeCart(s, 'viewer', 'b2', NOW)).toEqual([]);
    expect(loadTradeCart(s, 'someone-else', 'b1', NOW)).toEqual([]);
  });

  it('removes the entry when the cart is emptied', () => {
    const s = memoryStorage();
    saveTradeCart(s, 'viewer', 'binder', [card('a')], NOW);
    saveTradeCart(s, 'viewer', 'binder', [], NOW);
    expect(s.getItem(tradeCartKey('viewer', 'binder'))).toBeNull();
  });

  it('drops a cart older than the TTL', () => {
    const s = memoryStorage();
    saveTradeCart(s, 'viewer', 'binder', [card('a')], NOW);
    expect(loadTradeCart(s, 'viewer', 'binder', NOW + TRADE_CART_TTL_MS + 1)).toEqual([]);
    expect(s.getItem(tradeCartKey('viewer', 'binder'))).toBeNull();
  });

  it('returns an empty cart for corrupt data instead of throwing', () => {
    const s = memoryStorage();
    s.setItem(tradeCartKey('viewer', 'binder'), '{not json');
    expect(loadTradeCart(s, 'viewer', 'binder', NOW)).toEqual([]);
  });

  it('survives a storage that throws (private mode, blocked site data)', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(() => saveTradeCart(broken, 'v', 'b', [card('a')], NOW)).not.toThrow();
    expect(loadTradeCart(broken, 'v', 'b', NOW)).toEqual([]);
  });
});
