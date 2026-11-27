import { describe, it, expect } from 'vitest'
import type { DeckDTO } from '@/lib/services/contracts/IDeckService'
import { parseFabraryDeck } from '@/lib/browse/parsers/fabrary-deck-parser'
import { buildDeckExportText } from './deck-export-text'

// The Options menu's "Copy list" / "Export" text. Laid out like a FaBrary
// export (Name / Hero / Format, then "Arena cards" and "Deck cards") so it
// pastes back into our own importer, plus an "Inventory" section for the
// inventory zone.
const card = (name: string, quantity: number, pitch?: number, extra: Record<string, unknown> = {}) => ({
  printingId: `${name}-${pitch ?? 0}-${quantity}`,
  quantity,
  printingDetails: { display_name: name, pitch, ...extra },
})

const deck = (over: Record<string, unknown>) =>
  ({
    name: 'Fatigue Bravo',
    format: 'Classic Constructed',
    heroName: 'Bravo, Showstopper',
    hero: [],
    equipment: [],
    maindeck: [],
    inventory: [],
    ...over,
  }) as unknown as DeckDTO

describe('buildDeckExportText', () => {
  it('opens with the deck name, hero and format', () => {
    const text = buildDeckExportText(deck({ maindeck: [card('Sink Below', 3, 1)] }))
    expect(text.split('\n').slice(0, 4)).toEqual([
      'Name: Fatigue Bravo',
      'Hero: Bravo, Showstopper',
      'Format: Classic Constructed',
      '',
    ])
  })

  it('falls back to the hero card when the deck has no hero name, and drops a header line with no value', () => {
    const text = buildDeckExportText(deck({
      name: '',
      heroName: undefined,
      hero: [card('Dash, Inventor Extraordinaire', 1)],
      maindeck: [card('Zipper Hit', 3, 1)],
    }))
    expect(text.split('\n').slice(0, 3)).toEqual(['Hero: Dash, Inventor Extraordinaire', 'Format: Classic Constructed', ''])
  })

  it('puts equipment, main deck and inventory in their own sections', () => {
    const text = buildDeckExportText(deck({
      equipment: [card('Anothos', 1)],
      maindeck: [card('Sink Below', 3, 1)],
      inventory: [card('Nullrune Boots', 1), card('Oasis Respite', 2, 1)],
    }))
    expect(text).toBe([
      'Name: Fatigue Bravo',
      'Hero: Bravo, Showstopper',
      'Format: Classic Constructed',
      '',
      'Arena cards',
      '1x Anothos',
      '',
      'Deck cards',
      '3x Sink Below (red)',
      '',
      'Inventory',
      '1x Nullrune Boots',
      '2x Oasis Respite (red)',
    ].join('\n'))
  })

  it('leaves out a section with no cards', () => {
    const text = buildDeckExportText(deck({ maindeck: [card('Sink Below', 3, 1)] }))
    expect(text).not.toContain('Arena cards')
    expect(text).not.toContain('Inventory')
    expect(text.endsWith('Deck cards\n3x Sink Below (red)')).toBe(true)
  })

  it('merges printings of the same card and spells the pitch colour out', () => {
    const text = buildDeckExportText(deck({
      maindeck: [card('Mocking Blow', 2, 1), card('Mocking Blow', 1, 1, { set: 'other printing' }), card('Mocking Blow', 3, 3), card('Midas Touch', 2, 2)],
    }))
    expect(text.split('\n').slice(5)).toEqual(['3x Mocking Blow (red)', '2x Midas Touch (yellow)', '3x Mocking Blow (blue)'])
  })

  it('sorts each section by pitch (none, red, yellow, blue), then by name', () => {
    const text = buildDeckExportText(deck({
      equipment: [card('Titan\'s Fist', 1), card('Anothos', 1)],
      maindeck: [card('Zipper Hit', 3, 2), card('Crankshaft', 3, 3), card('T-Bone', 3, 1), card('Crankshaft', 3, 1), card('Hyper-X3', 1)],
    }))
    expect(text.split('\n').slice(4)).toEqual([
      'Arena cards',
      '1x Anothos',
      "1x Titan's Fist",
      '',
      'Deck cards',
      '1x Hyper-X3',
      '3x Crankshaft (red)',
      '3x T-Bone (red)',
      '3x Zipper Hit (yellow)',
      '3x Crankshaft (blue)',
    ])
  })

  it('keeps the same card separate between the main deck and the inventory', () => {
    const text = buildDeckExportText(deck({
      maindeck: [card('Sink Below', 2, 1)],
      inventory: [card('Sink Below', 1, 1)],
    }))
    expect(text.split('\n').slice(4)).toEqual(['Deck cards', '2x Sink Below (red)', '', 'Inventory', '1x Sink Below (red)'])
  })

  it('never exports the benched pile or tokens', () => {
    const text = buildDeckExportText(deck({
      maindeck: [card('Sink Below', 3, 1)],
      benched: [card('Maybe Card', 1, 1)],
      tokens: [card('Quicken', 1)],
    }))
    expect(text).not.toContain('Maybe Card')
    expect(text).not.toContain('Quicken')
  })

  it('falls back to the card name, then the printing id, when there is no display name', () => {
    const text = buildDeckExportText(deck({
      maindeck: [
        { printingId: 'p1', quantity: 1, printingDetails: { name: 'sink below', pitch: 2 } },
        { printingId: 'p2', quantity: 1 },
      ],
    }))
    expect(text.split('\n').slice(5)).toEqual(['1x p2', '1x sink below (yellow)'])
  })

  it('reads back through our FaBrary importer with the same header and cards', () => {
    const parsed = parseFabraryDeck(buildDeckExportText(deck({
      equipment: [card('Anothos', 1)],
      maindeck: [card('Sink Below', 3, 1), card('Midas Touch', 2, 2), card('Show Time!', 3, 3)],
      inventory: [card('Nullrune Boots', 1)],
    })))
    expect(parsed.name).toBe('Fatigue Bravo')
    expect(parsed.heroName).toBe('Bravo, Showstopper')
    expect(parsed.format).toBe('Classic Constructed')
    // the parser lowercases card names
    expect(parsed.cards.map(c => `${c.quantity} ${c.name} ${c.color ?? ''}`.trim())).toEqual([
      '1 anothos',
      '3 sink below red',
      '2 midas touch yellow',
      '3 show time! blue',
      '1 nullrune boots',
    ])
  })
})
