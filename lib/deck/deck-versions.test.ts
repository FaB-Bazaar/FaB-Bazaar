import { describe, it, expect } from 'vitest'
import type { DeckDTO } from '@/lib/services/contracts/IDeckService'
import {
  deckToVersionCards, diffVersionCards, normalizeVersionCards, sanitizeVersionLabel,
  versionContentKey, versionCounts, type VersionCard,
} from './deck-versions'

const vc = (name: string, quantity: number, category: VersionCard['category'], pitch: number | null = null, printingId = `${name}-${pitch ?? 0}`): VersionCard =>
  ({ printingId, cardUniqueId: `card-${name}-${pitch ?? 0}`, name, pitch, quantity, category })

describe('normalizeVersionCards', () => {
  it('orders by zone, then pitch, then name, and drops empty rows', () => {
    const cards = normalizeVersionCards([
      vc('Sink Below', 3, 'maindeck', 3),
      vc('Nullrune Boots', 1, 'inventory'),
      vc('Anothos', 1, 'equipment'),
      vc('Gone', 0, 'maindeck', 1),
      vc('Crippling Crush', 3, 'maindeck', 1),
      vc('Bravo, Showstopper', 1, 'hero'),
      vc('Act of Glory', 3, 'maindeck', 3),
    ])
    expect(cards.map(c => `${c.category}/${c.name}`)).toEqual([
      'hero/Bravo, Showstopper',
      'equipment/Anothos',
      'maindeck/Crippling Crush',
      'maindeck/Act of Glory',
      'maindeck/Sink Below',
      'inventory/Nullrune Boots',
    ])
  })

  it('merges two rows for the same printing in the same zone', () => {
    const cards = normalizeVersionCards([vc('Sink Below', 2, 'maindeck', 1, 'p1'), vc('Sink Below', 1, 'maindeck', 1, 'p1')])
    expect(cards).toHaveLength(1)
    expect(cards[0].quantity).toBe(3)
  })
})

describe('versionContentKey', () => {
  const a = [vc('Sink Below', 3, 'maindeck', 1, 'p1'), vc('Anothos', 1, 'equipment', null, 'p2')]

  it('is the same whatever order the cards arrive in', () => {
    expect(versionContentKey([...a].reverse())).toBe(versionContentKey(a))
  })

  it('ignores names — only printing, zone and quantity count', () => {
    const renamed = a.map(c => ({ ...c, name: `${c.name}!` }))
    expect(versionContentKey(renamed)).toBe(versionContentKey(a))
  })

  it('changes with a quantity, a zone or a printing', () => {
    const key = versionContentKey(a)
    expect(versionContentKey([{ ...a[0], quantity: 2 }, a[1]])).not.toBe(key)
    expect(versionContentKey([{ ...a[0], category: 'inventory' }, a[1]])).not.toBe(key)
    expect(versionContentKey([{ ...a[0], printingId: 'p9' }, a[1]])).not.toBe(key)
  })
})

describe('versionCounts', () => {
  it('totals copies per zone', () => {
    expect(versionCounts([vc('A', 3, 'maindeck', 1), vc('B', 2, 'maindeck', 2), vc('C', 1, 'equipment'), vc('D', 4, 'inventory', 3)])).toEqual({
      hero: 0, equipment: 1, maindeck: 5, inventory: 4, benched: 0, tokens: 0,
    })
  })
})

describe('deckToVersionCards', () => {
  it('reads every zone of a live deck into version cards', () => {
    const deck = {
      hero: [{ printingId: 'h', quantity: 1, printingDetails: { display_name: 'Dash', card_unique_id: 'c-h' } }],
      equipment: [{ printingId: 'e', printingDetails: { name: 'banksy' } }],
      maindeck: [{ printingId: 'm', quantity: 3, printingDetails: { display_name: 'Zipper Hit', pitch: 1, card_unique_id: 'c-m' } }],
      inventory: [{ printingId: 'i', quantity: 2, printingDetails: { display_name: 'Hit the Gas', pitch: 3 } }],
      benched: [{ printingId: 'b', quantity: 1, printingDetails: { display_name: 'Maybe', pitch: 2 } }],
    } as unknown as DeckDTO
    expect(deckToVersionCards(deck)).toEqual([
      { printingId: 'h', cardUniqueId: 'c-h', name: 'Dash', pitch: null, quantity: 1, category: 'hero' },
      { printingId: 'e', cardUniqueId: null, name: 'banksy', pitch: null, quantity: 1, category: 'equipment' },
      { printingId: 'm', cardUniqueId: 'c-m', name: 'Zipper Hit', pitch: 1, quantity: 3, category: 'maindeck' },
      { printingId: 'i', cardUniqueId: null, name: 'Hit the Gas', pitch: 3, quantity: 2, category: 'inventory' },
      { printingId: 'b', cardUniqueId: null, name: 'Maybe', pitch: 2, quantity: 1, category: 'benched' },
    ])
  })
})

describe('diffVersionCards', () => {
  it('reports nothing when the lists match', () => {
    const cards = [vc('Sink Below', 3, 'maindeck', 1)]
    expect(diffVersionCards(cards, cards)).toEqual([])
  })

  it('lists what was added and removed in each zone, by name and pitch', () => {
    const before = [vc('Sink Below', 3, 'maindeck', 1), vc('Fate Foreseen', 3, 'maindeck', 1), vc('Anothos', 1, 'equipment')]
    const after = [vc('Sink Below', 2, 'maindeck', 1), vc('Oasis Respite', 3, 'maindeck', 1), vc('Anothos', 1, 'equipment'), vc("Titan's Fist", 1, 'equipment')]
    expect(diffVersionCards(before, after)).toEqual([
      { zone: 'equipment', label: 'Arena cards', added: [{ name: "Titan's Fist", pitch: null, quantity: 1 }], removed: [] },
      {
        zone: 'maindeck', label: 'Deck cards',
        added: [{ name: 'Oasis Respite', pitch: 1, quantity: 3 }],
        removed: [{ name: 'Fate Foreseen', pitch: 1, quantity: 3 }, { name: 'Sink Below', pitch: 1, quantity: 1 }],
      },
    ])
  })

  it('shows a card moved to the sideboard as out of the deck and into the sideboard', () => {
    const before = [vc('Sink Below', 3, 'maindeck', 1)]
    const after = [vc('Sink Below', 2, 'maindeck', 1), vc('Sink Below', 1, 'inventory', 1)]
    expect(diffVersionCards(before, after)).toEqual([
      { zone: 'maindeck', label: 'Deck cards', added: [], removed: [{ name: 'Sink Below', pitch: 1, quantity: 1 }] },
      { zone: 'inventory', label: 'Sideboard', added: [{ name: 'Sink Below', pitch: 1, quantity: 1 }], removed: [] },
    ])
  })

  it('does not count a printing swap as a change', () => {
    const before = [vc('Sink Below', 3, 'maindeck', 1, 'regular')]
    const after = [vc('Sink Below', 3, 'maindeck', 1, 'rainbow-foil')]
    expect(diffVersionCards(before, after)).toEqual([])
  })

  it('leaves tokens out', () => {
    expect(diffVersionCards([], [vc('Quicken', 1, 'tokens')])).toEqual([])
  })
})

describe('sanitizeVersionLabel', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeVersionLabel('  Before   the\nCalling ')).toBe('Before the Calling')
  })
  it('cuts a long note to 80 characters', () => {
    expect(sanitizeVersionLabel('x'.repeat(200))).toHaveLength(80)
  })
  it('reads blank or non-text input as no note', () => {
    expect(sanitizeVersionLabel('   ')).toBeNull()
    expect(sanitizeVersionLabel(undefined)).toBeNull()
    expect(sanitizeVersionLabel(42)).toBeNull()
  })
})
