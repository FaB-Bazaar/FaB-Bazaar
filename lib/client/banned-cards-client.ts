import type { BannedCardDTO, BannedFormat } from '@/lib/services/contracts/IBannedCardsService'

/**
 * Maps the app's human-readable deck format strings (as stored in `decks.format`,
 * e.g. "Classic Constructed") to the snake_case codes used by the banned_cards
 * table and API (`classic_constructed`).
 *
 * Returns null when the deck is in a format with no ban registry (e.g. Open,
 * Draft, Sealed, Clash) — callers should treat that as "nothing is banned".
 */
export function deckFormatToBannedFormat(deckFormat?: string | null): BannedFormat | null {
  if (!deckFormat) return null
  const key = deckFormat.trim().toLowerCase()
  switch (key) {
    case 'classic constructed':
    case 'cc':
      return 'classic_constructed'
    case 'silver age':
      return 'silver_age'
    case 'living legend':
    case 'll':
      return 'living_legend'
    case 'blitz':
      return 'blitz'
    case 'commoner':
      return 'commoner'
    default:
      return null
  }
}

// In-memory cache: format → { fetched-at, set of banned card_unique_ids }
const cache = new Map<BannedFormat, { fetchedAt: number; ids: Set<string>; entries: BannedCardDTO[] }>()
const TTL_MS = 5 * 60 * 1000 // mirror the server Redis TTL

export async function fetchBannedCardsForFormat(format: BannedFormat): Promise<{ ids: Set<string>; entries: BannedCardDTO[] }> {
  const cached = cache.get(format)
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { ids: cached.ids, entries: cached.entries }
  }
  const res = await fetch(`/api/banned-cards?format=${format}`, { credentials: 'include' })
  const body = await res.json().catch(() => null)
  if (!body?.success) {
    return { ids: new Set(), entries: [] }
  }
  const entries = body.data as BannedCardDTO[]
  const ids = new Set(entries.map(e => e.cardUniqueId))
  cache.set(format, { fetchedAt: Date.now(), ids, entries })
  return { ids, entries }
}

export function invalidateBannedCardsCache(format?: BannedFormat) {
  if (format) cache.delete(format)
  else cache.clear()
}
