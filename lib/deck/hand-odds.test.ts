import { describe, it, expect } from 'vitest'
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { handOdds, librarySplit } from './hand-odds'

const comb = (n: number, k: number): number => (k < 0 || k > n ? 0 : k === 0 ? 1 : (comb(n - 1, k - 1) * n) / k)
const card = (qty: number, details: Record<string, unknown>): DeckPrintingDTO => ({ printingId: Math.random().toString(), quantity: qty, printingDetails: details })

describe('handOdds — one measure (plain hypergeometric)', () => {
  it('at least 1 of 34 in a 4-card hand from 60', () => {
    const p = handOdds({ aOnly: 34, bOnly: 0, both: 0, neither: 26 }, 4, { mode: 'atLeast', count: 1 })
    expect(p).toBeCloseTo(1 - comb(26, 4) / comb(60, 4), 10)
  })

  it('exactly 2 of 9 in a 4-card hand from 60', () => {
    const p = handOdds({ aOnly: 9, bOnly: 0, both: 0, neither: 51 }, 4, { mode: 'exactly', count: 2 })
    expect(p).toBeCloseTo((comb(9, 2) * comb(51, 2)) / comb(60, 4), 10)
  })
})

describe('handOdds — two measures (multivariate, overlap-aware)', () => {
  it('≥3 A and ≥1 B with no overlap = C(34,3)·C(9,1)/C(60,4) for a 4-card hand', () => {
    const p = handOdds({ aOnly: 34, bOnly: 9, both: 0, neither: 17 }, 4, { mode: 'atLeast', count: 3 }, { mode: 'atLeast', count: 1 })
    expect(p).toBeCloseTo((comb(34, 3) * comb(9, 1)) / comb(60, 4), 10) // 11.0%
  })

  it('a card that is both A and B counts for both sides (brute force on a tiny deck)', () => {
    // deck: [A, AB, B, x] — hands of 2
    const split = { aOnly: 1, bOnly: 1, both: 1, neither: 1 }
    const cards = ['A', 'AB', 'B', 'x']
    let hits = 0, total = 0
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      total++
      const hand = [cards[i], cards[j]]
      const a = hand.filter(c => c.includes('A')).length
      const b = hand.filter(c => c.includes('B')).length
      if (a >= 1 && b >= 1) hits++
    }
    expect(handOdds(split, 2, { mode: 'atLeast', count: 1 }, { mode: 'atLeast', count: 1 })).toBeCloseTo(hits / total, 10)
  })

  it('caps the hand at the library size and treats an empty library as 0', () => {
    expect(handOdds({ aOnly: 2, bOnly: 1, both: 0, neither: 0 }, 4, { mode: 'atLeast', count: 1 }, { mode: 'atLeast', count: 1 })).toBe(1)
    expect(handOdds({ aOnly: 0, bOnly: 0, both: 0, neither: 0 }, 4, { mode: 'atLeast', count: 1 })).toBe(0)
  })
})

describe('librarySplit', () => {
  it('draws from the main deck only, leaving out equipment/weapons filed there', () => {
    const deck = {
      hero: [], benched: [], inventory: [card(3, { pitch: 1 })],
      equipment: [card(1, { types: ['equipment'], pitch: 1 })],
      maindeck: [
        card(2, { pitch: 1, types: ['action'] }),
        card(1, { pitch: 2, types: ['action'] }),
        card(1, { pitch: 1, types: ['mechanologist', 'equipment', 'legs'] }), // filed in main by mistake
      ],
    } as unknown as DeckDTO
    expect(librarySplit(deck, { kind: 'pitch', value: '1' }, { kind: 'pitch', value: '2' })).toEqual({ aOnly: 2, bOnly: 1, both: 0, neither: 0 })
    expect(librarySplit(deck, { kind: 'pitch', value: '1' })).toEqual({ aOnly: 2, bOnly: 0, both: 0, neither: 1 })
  })
})

describe('librarySplit — with a matchup plan applied', () => {
  // main: 2 Mocking Blow (red), 1 (yellow); inventory: 2 (blue)
  const deck = {
    hero: [], benched: [], equipment: [],
    maindeck: [card(2, { name: 'mocking blow', pitch: 1, types: ['action'] }), card(1, { name: 'mocking blow', pitch: 2, types: ['action'] })],
    inventory: [card(2, { name: 'mocking blow', pitch: 3, types: ['action'] })],
  } as unknown as DeckDTO
  const red = { kind: 'pitch' as const, value: '1' }
  const blue = { kind: 'pitch' as const, value: '3' }

  it('takes out the "out" copies and adds the "in" copies from inventory', () => {
    const matchup = { in: ['mocking_blow_blue', 'mocking_blow_blue'], out: ['mocking_blow_red'] }
    expect(librarySplit(deck, red, blue, matchup)).toEqual({ aOnly: 1, bOnly: 2, both: 0, neither: 1 })
  })

  it('never counts inventory without a plan, and ignores ids that match nothing', () => {
    expect(librarySplit(deck, red, blue)).toEqual({ aOnly: 2, bOnly: 0, both: 0, neither: 1 })
    expect(librarySplit(deck, red, blue, { in: ['no_such_card'], out: ['nor_this'] })).toEqual({ aOnly: 2, bOnly: 0, both: 0, neither: 1 })
  })
})
