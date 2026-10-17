// Viewer's price source (TCGplayer $ / Cardmarket €). Account-wide for signed-in
// users (users.cardmarket_prices via POST /api/user/cardmarket-prices); this
// localStorage copy makes the first render right and is the only store for
// signed-out visitors. Every access is guarded — storage throws in private mode
// and doesn't exist during SSR.
import type { PriceSource } from './price-source'

export const PRICE_SOURCE_KEY = 'fabb:price-source'
const CHANGE_EVENT = 'fabb:price-source-change'

export function readPriceSource(): PriceSource {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PRICE_SOURCE_KEY) === 'cardmarket'
      ? 'cardmarket'
      : 'tcgplayer'
  } catch {
    return 'tcgplayer'
  }
}

export function writePriceSource(source: PriceSource): void {
  try {
    if (source === 'cardmarket') window.localStorage.setItem(PRICE_SOURCE_KEY, 'cardmarket')
    else window.localStorage.removeItem(PRICE_SOURCE_KEY)
  } catch {
    // storage unavailable — the choice just won't persist on this device
  }
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // no window (SSR)
  }
}

/** Fires on writes in this tab and on changes from other tabs. Returns unsubscribe. */
export function subscribePriceSource(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: Event) => {
    const key = (e as StorageEvent).key
    if (key === PRICE_SOURCE_KEY || key === null) cb()
  }
  window.addEventListener(CHANGE_EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}
