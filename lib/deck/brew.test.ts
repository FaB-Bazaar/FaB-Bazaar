import { describe, it, expect } from 'vitest'
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { lensToSearchFilters, notInDeck } from './brew'

const card = (id: string, cardId: string): DeckPrintingDTO => ({
  printingId: id,
  quantity: 1,
  printingDetails: { card_unique_id: cardId },
})

describe('lensToSearchFilters', () => {
  it('maps a text lens to a rules-text search', () => {
    expect(lensToSearchFilters({ stat: 'text', value: 'discard' })).toEqual({ text: 'discard' })
  })

  it('maps a keyword lens to a keyword filter', () => {
    expect(lensToSearchFilters({ stat: 'keyword', value: 'go again' })).toEqual({ keywords: ['go again'] })
  })

  it('maps type buckets to the same meaning the deck highlight uses', () => {
    expect(lensToSearchFilters({ stat: 'type', value: 'attack' })).toEqual({ types: ['action'], subtypes: ['attack'] })
    expect(lensToSearchFilters({ stat: 'type', value: 'non-attack' })).toEqual({ types: ['action'], typesNot: ['attack'] })
    expect(lensToSearchFilters({ stat: 'type', value: 'defense-reaction' })).toEqual({ types: ['defense reaction'] })
    expect(lensToSearchFilters({ stat: 'type', value: 'attack-reaction' })).toEqual({ types: ['attack reaction'] })
    expect(lensToSearchFilters({ stat: 'type', value: 'item' })).toEqual({ types: ['item'] })
  })

  it('adds nothing without a lens', () => {
    expect(lensToSearchFilters(null)).toEqual({})
  })
})

describe('notInDeck', () => {
  it('drops search results for cards already in any deck zone', () => {
    const deck = {
      hero: [card('h', 'hero-card')], equipment: [], benched: [card('b', 'benched-card')],
      maindeck: [card('m1', 'in-main')], inventory: [card('i1', 'in-inv')],
    } as unknown as DeckDTO
    const results = [{ unique_id: 'in-main' }, { unique_id: 'new-1' }, { unique_id: 'in-inv' }, { unique_id: 'benched-card' }, { unique_id: 'new-2' }]
    expect(notInDeck(results, deck).map(r => r.unique_id)).toEqual(['new-1', 'new-2'])
  })
})
