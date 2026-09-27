import { describe, it, expect } from 'vitest'
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { countTextMatches, formatRatio, keywordTally, pitchSplit, playableCount, typeTally } from './deck-lens'

const card = (id: string, quantity: number, details: Record<string, unknown>): DeckPrintingDTO => ({
  printingId: id,
  quantity,
  printingDetails: details,
})

const deck = (zones: Partial<Pick<DeckDTO, 'maindeck' | 'equipment' | 'inventory' | 'hero' | 'benched'>>) =>
  ({ hero: [], equipment: [], maindeck: [], inventory: [], benched: [], ...zones }) as unknown as DeckDTO

describe('countTextMatches', () => {
  it('counts copies and distinct cards whose rules text contains the term', () => {
    const d = deck({
      maindeck: [
        card('a', 3, { text: 'As an additional cost, **discard** a card.' }),
        card('b', 2, { text: 'Your opponent discards a card.' }),
        card('c', 3, { text: 'Create a Gate to I\'arathael token.' }),
      ],
    })
    expect(countTextMatches(d, 'discard')).toEqual({ copies: 5, cards: 2 })
    expect(countTextMatches(d, 'gate')).toEqual({ copies: 3, cards: 1 })
  })

  it('counts the playable deck only — equipment yes, inventory/bench/hero no', () => {
    const d = deck({
      hero: [card('h', 1, { text: 'discard' })],
      equipment: [card('e', 1, { text: 'discard' })],
      inventory: [card('i', 3, { text: 'discard' })],
      benched: [card('x', 3, { text: 'discard' })],
    })
    expect(countTextMatches(d, 'discard')).toEqual({ copies: 1, cards: 1 })
  })

  it('returns zero for a blank term', () => {
    const d = deck({ maindeck: [card('a', 3, { text: 'discard' })] })
    expect(countTextMatches(d, '  ')).toEqual({ copies: 0, cards: 0 })
  })
})

describe('keywordTally', () => {
  it('sums copies per keyword, most common first, preferring display casing', () => {
    const d = deck({
      maindeck: [
        card('a', 3, { keywords_display: ['Go again'], keywords: ['go again'] }),
        card('b', 2, { keywords: ['go again', 'opt'] }),
        card('c', 1, { keywords_display: ['Opt 2'] }),
      ],
    })
    expect(keywordTally(d)).toEqual([
      { keyword: 'Go again', copies: 5 },
      { keyword: 'Opt', copies: 3 },
    ])
  })
})

describe('typeTally', () => {
  it('buckets cards by the same type values the deck highlight understands', () => {
    const d = deck({
      maindeck: [
        card('a', 3, { types: ['Runeblade', 'Action', 'Attack'] }),
        card('b', 2, { types: ['Generic', 'Action'] }),
        card('c', 3, { types: ['Generic', 'Defense Reaction'] }),
        card('d', 1, { types: ['Generic', 'Instant'] }),
      ],
    })
    expect(typeTally(d)).toEqual([
      { value: 'attack', label: 'Attack', copies: 3 },
      { value: 'defense-reaction', label: 'Defense reaction', copies: 3 },
      { value: 'non-attack', label: 'Non-attack action', copies: 2 },
      { value: 'instant', label: 'Instant', copies: 1 },
    ])
  })
})

describe('playableCount', () => {
  it('sums maindeck + equipment copies', () => {
    const d = deck({
      maindeck: [card('a', 3, {}), card('b', 2, {})],
      equipment: [card('e', 1, {})],
      inventory: [card('i', 3, {})],
    })
    expect(playableCount(d)).toBe(6)
  })
})

describe('formatRatio', () => {
  it('reduces to "x : 1" against the smaller side', () => {
    expect(formatRatio(12, 6)).toBe('2 : 1')
    expect(formatRatio(6, 12)).toBe('1 : 2')
    expect(formatRatio(10, 4)).toBe('2.5 : 1')
    expect(formatRatio(7, 7)).toBe('1 : 1')
  })

  it('has no ratio when either side is zero', () => {
    expect(formatRatio(5, 0)).toBeNull()
    expect(formatRatio(0, 0)).toBeNull()
  })
})

describe('pitchSplit', () => {
  it('splits playable copies by pitch and averages cost over costed cards', () => {
    const d = deck({
      maindeck: [card('r', 3, { pitch: 1, cost: 0 }), card('y', 2, { pitch: 2, cost: 2 }), card('b', 3, { pitch: 3, cost: 1 })],
      equipment: [card('e', 1, {})],
      inventory: [card('i', 3, { pitch: 1, cost: 0 })],
    })
    expect(pitchSplit(d)).toEqual({ red: 3, yellow: 2, blue: 3, none: 1, averageCost: 7 / 8 })
  })

  it('has no average cost when nothing has a cost', () => {
    expect(pitchSplit(deck({})).averageCost).toBeNull()
  })
})
