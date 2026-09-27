// Deck v2 "Brew" tab: the deck's legal pool minus what's already in the deck.
// The left panel's lens (text / type / keyword) narrows the pool with the same
// meaning it has when highlighting the deck.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService'
import type { Lens } from './deck-table'

// Type buckets (deck-lens TYPE_BUCKETS) expressed as server filters:
// `types` = one OR overlap, `subtypes` = a second ANDed overlap, `typesNot` excludes.
const TYPE_FILTERS: Record<string, Pick<PrintingsSearchFilters, 'types' | 'subtypes' | 'typesNot'>> = {
  'attack': { types: ['action'], subtypes: ['attack'] },
  'non-attack': { types: ['action'], typesNot: ['attack'] },
  'defense-reaction': { types: ['defense reaction'] },
  'attack-reaction': { types: ['attack reaction'] },
}

export function lensToSearchFilters(lens: Lens | null): Partial<PrintingsSearchFilters> {
  if (!lens) return {}
  if (lens.stat === 'text') return { text: lens.value }
  if (lens.stat === 'keyword') return { keywords: [lens.value] }
  return TYPE_FILTERS[lens.value] ?? { types: [lens.value] }
}

/** Search results (grouped by card) minus cards already anywhere in the deck — bench included. */
export function notInDeck<T extends { unique_id: string }>(results: T[], deck: DeckDTO): T[] {
  const inDeck = new Set<string>()
  for (const zone of ['hero', 'equipment', 'maindeck', 'inventory', 'benched'] as const) {
    for (const c of ((deck[zone] as DeckPrintingDTO[] | undefined) ?? [])) {
      const id = c.printingDetails?.card_unique_id as string | undefined
      if (id) inDeck.add(id)
    }
  }
  return results.filter(r => !inDeck.has(r.unique_id))
}
