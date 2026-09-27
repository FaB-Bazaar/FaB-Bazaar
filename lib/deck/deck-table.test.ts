import { describe, it, expect } from 'vitest'
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { buildDeckTableRows, matchesLens, partitionByLens, sortDeckTableRows } from './deck-table'

const card = (id: string, quantity: number, details: Record<string, unknown>): DeckPrintingDTO => ({
  printingId: id,
  quantity,
  printingDetails: details,
})

const deck = (zones: Partial<Pick<DeckDTO, 'maindeck' | 'equipment' | 'inventory' | 'hero' | 'benched'>>) =>
  ({ hero: [], equipment: [], maindeck: [], inventory: [], benched: [], ...zones }) as unknown as DeckDTO

describe('buildDeckTableRows', () => {
  it('makes one row per card per zone, summing printings of the same card', () => {
    const rows = buildDeckTableRows(deck({
      maindeck: [
        card('p1', 2, { card_unique_id: 'c1', display_name: 'Hyper Driver', pitch: 1, cost: 0 }),
        card('p2', 1, { card_unique_id: 'c1', display_name: 'Hyper Driver', pitch: 1, cost: 0 }),
      ],
      inventory: [card('p3', 1, { card_unique_id: 'c1', display_name: 'Hyper Driver', pitch: 1 })],
    }))
    expect(rows.map(r => [r.zone, r.name, r.qty, r.printingIds])).toEqual([
      ['maindeck', 'Hyper Driver', 3, ['p1', 'p2']],
      ['inventory', 'Hyper Driver', 1, ['p3']],
    ])
  })

  it('orders zones hero → equipment → main deck → inventory → bench', () => {
    const rows = buildDeckTableRows(deck({
      benched: [card('b', 1, { display_name: 'B' })],
      maindeck: [card('m', 1, { display_name: 'M' })],
      hero: [card('h', 1, { display_name: 'H' })],
      inventory: [card('i', 1, { display_name: 'I' })],
      equipment: [card('e', 1, { display_name: 'E' })],
    }))
    expect(rows.map(r => r.zone)).toEqual(['hero', 'equipment', 'maindeck', 'inventory', 'benched'])
  })
})

describe('sortDeckTableRows', () => {
  const rows = buildDeckTableRows(deck({
    maindeck: [
      card('a', 3, { display_name: 'Zipper Hit', pitch: 1, cost: 1 }),
      card('b', 3, { display_name: 'Big Bertha', pitch: 3, cost: 3 }),
      card('c', 2, { display_name: 'Clamp Press', pitch: 2 }),
    ],
    equipment: [card('e', 1, { display_name: 'Banksy' })],
  }))

  it('defaults to zone, then pitch, then name', () => {
    expect(sortDeckTableRows(rows, null).map(r => r.name)).toEqual(['Banksy', 'Zipper Hit', 'Clamp Press', 'Big Bertha'])
  })

  it('sorts by a column, blanks last in either direction', () => {
    expect(sortDeckTableRows(rows, { key: 'cost', dir: 'asc' }).map(r => r.name)).toEqual(['Zipper Hit', 'Big Bertha', 'Banksy', 'Clamp Press'])
    expect(sortDeckTableRows(rows, { key: 'cost', dir: 'desc' }).map(r => r.name)).toEqual(['Big Bertha', 'Zipper Hit', 'Banksy', 'Clamp Press'])
    expect(sortDeckTableRows(rows, { key: 'name', dir: 'asc' }).map(r => r.name)).toEqual(['Banksy', 'Big Bertha', 'Clamp Press', 'Zipper Hit'])
  })
})

describe('matchesLens', () => {
  it('matches rules text, type buckets and keywords the way the deck highlight does', () => {
    const d = { text: 'Discard a card.', types: ['Generic', 'Defense Reaction'], keywords: ['go again', 'opt 2'] }
    expect(matchesLens(d, { stat: 'text', value: 'discard' })).toBe(true)
    expect(matchesLens(d, { stat: 'type', value: 'defense-reaction' })).toBe(true)
    expect(matchesLens(d, { stat: 'type', value: 'attack' })).toBe(false)
    expect(matchesLens(d, { stat: 'keyword', value: 'opt' })).toBe(true)
    expect(matchesLens(d, { stat: 'keyword', value: 'boost' })).toBe(false)
  })
})

describe('partitionByLens', () => {
  it('splits rows into matches and the rest, keeping order', () => {
    const rows = buildDeckTableRows(deck({
      maindeck: [
        card('a', 1, { display_name: 'A', text: 'discard' }),
        card('b', 1, { display_name: 'B', text: 'draw' }),
        card('c', 1, { display_name: 'C', text: 'Discard two' }),
      ],
    }))
    const { matches, rest } = partitionByLens(rows, { stat: 'text', value: 'discard' })
    expect(matches.map(r => r.name)).toEqual(['A', 'C'])
    expect(rest.map(r => r.name)).toEqual(['B'])
  })
})

describe('type column', () => {
  it('prefers the printed type line, else title-cases the type list', () => {
    const rows = buildDeckTableRows(deck({
      maindeck: [
        card('a', 1, { display_name: 'A', type_text_display: 'Shadow Action - Attack', types: ['shadow', 'action', 'attack'] }),
        card('b', 1, { display_name: 'B', types: ['shadow', 'necromancer', 'defense reaction'] }),
      ],
    }))
    expect(rows.map(r => r.typeText)).toEqual(['Shadow Action - Attack', 'Shadow Necromancer Defense Reaction'])
  })
})
