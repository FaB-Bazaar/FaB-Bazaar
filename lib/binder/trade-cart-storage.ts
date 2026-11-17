/**
 * Persists a viewer's trade-request cart for one binder in localStorage so it
 * survives navigating away (the cart used to live only in React state).
 * Keyed per viewer + binder; expires after TRADE_CART_TTL_MS. Every storage
 * access is guarded — private mode / blocked site data must never break the page.
 */
export const TRADE_CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function tradeCartKey(viewerId: string, binderId: string): string {
  return `fab:trade-cart:${viewerId}:${binderId}`;
}

export function saveTradeCart<T>(
  storage: Storage,
  viewerId: string,
  binderId: string,
  cards: T[],
  now: number = Date.now()
): void {
  const key = tradeCartKey(viewerId, binderId);
  try {
    if (cards.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ savedAt: now, cards }));
  } catch {
    // storage unavailable or full — the in-memory cart still works
  }
}

export function loadTradeCart<T = any>(
  storage: Storage,
  viewerId: string,
  binderId: string,
  now: number = Date.now()
): T[] {
  const key = tradeCartKey(viewerId, binderId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cards) || typeof parsed.savedAt !== 'number') return [];
    if (now - parsed.savedAt > TRADE_CART_TTL_MS) {
      storage.removeItem(key);
      return [];
    }
    return parsed.cards as T[];
  } catch {
    return [];
  }
}
