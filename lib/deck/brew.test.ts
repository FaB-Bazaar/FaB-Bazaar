import { describe, it, expect } from 'vitest'
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'
import { brewFacetRows, deckCopiesByZone, deckHeroName, facetsToSearchFilters, facetsLabel, lensToSearchFilters, notInDeck, pitchSiblings } from './brew'

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

const withDetails = (id: string, qty: number, details: Record<string, unknown>): DeckPrintingDTO => ({
  printingId: id, quantity: qty, printingDetails: details,
})

describe('facetsToSearchFilters', () => {
  it('maps class, talent and rarity picks to server filters', () => {
    expect(facetsToSearchFilters({ class: 'generic' })).toEqual({ classes: ['generic'] })
    expect(facetsToSearchFilters({ class: 'mechanologist' })).toEqual({ classes: ['mechanologist'] })
    expect(facetsToSearchFilters({ talent: 'shadow' })).toEqual({ talents: ['shadow'] })
    expect(facetsToSearchFilters({ talent: 'talentless' })).toEqual({ talentless: true })
    expect(facetsToSearchFilters({ rarity: 'm' })).toEqual({ rarities: ['m'] })
  })

  it('combines picks from different sections', () => {
    expect(facetsToSearchFilters({ class: 'generic', rarity: 'l' })).toEqual({ classes: ['generic'], rarities: ['l'] })
  })
})

describe('facetsLabel', () => {
  it('names the picks for the Brew header', () => {
    expect(facetsLabel({ class: 'generic', talent: 'talentless', rarity: 'm' })).toBe('Generic · Talentless · Majestic')
    expect(facetsLabel({})).toBe('')
  })
})

describe('brewFacetRows', () => {
  const deck = {
    hero: [withDetails('h', 1, { classes: ['necromancer'], talents: ['shadow'] })],
    equipment: [],
    benched: [withDetails('b', 3, { classes: ['generic'], talents: [], rarity: 'l' })],
    maindeck: [
      withDetails('a', 3, { classes: ['necromancer'], talents: ['shadow'], rarity: 'r' }),
      withDetails('g', 2, { classes: ['generic'], talents: [], rarity: 'm' }),
    ],
    inventory: [withDetails('i', 1, { classes: ['necromancer'], talents: [], rarity: 'c' })],
  } as unknown as DeckDTO

  it("offers the hero's classes + Generic and talents + Talentless, counted from the deck (not hero/bench)", () => {
    const rows = brewFacetRows(deck, { heroClasses: ['necromancer'], heroTalents: ['shadow'], heroEssences: [] })
    expect(rows.classes).toEqual([
      { value: 'necromancer', label: 'Necromancer', copies: 4 },
      { value: 'generic', label: 'Generic', copies: 2 },
    ])
    expect(rows.talents).toEqual([
      { value: 'shadow', label: 'Shadow', copies: 3 },
      { value: 'talentless', label: 'Talentless', copies: 3 },
    ])
  })

  it('has no talent rows for a talentless hero', () => {
    expect(brewFacetRows(deck, { heroClasses: ['necromancer'], heroTalents: [], heroEssences: [] }).talents).toEqual([])
  })

  it('lists the six card rarities, highest first, with deck counts', () => {
    expect(brewFacetRows(deck, null).rarities).toEqual([
      { value: 'f', label: 'Fabled', copies: 0 },
      { value: 'l', label: 'Legendary', copies: 0 },
      { value: 'm', label: 'Majestic', copies: 2 },
      { value: 's', label: 'Super Rare', copies: 0 },
      { value: 'r', label: 'Rare', copies: 3 },
      { value: 'c', label: 'Common', copies: 1 },
    ])
  })
})

describe('notInDeck keep-list', () => {
  it('keeps cards added during this Brew session visible even though they are now in the deck', () => {
    const deck = { hero: [], equipment: [], benched: [card('b', 'just-added')], maindeck: [card('m', 'old')], inventory: [] } as unknown as DeckDTO
    const results = [{ unique_id: 'old' }, { unique_id: 'just-added' }, { unique_id: 'new' }]
    expect(notInDeck(results, deck, new Set(['just-added'])).map(r => r.unique_id)).toEqual(['just-added', 'new'])
  })
})

describe('deckCopiesByZone', () => {
  it('counts a card per zone, naming the printing to undo from', () => {
    const deck = {
      hero: [], equipment: [],
      maindeck: [withDetails('p1', 2, { card_unique_id: 'c' }), withDetails('p9', 3, { card_unique_id: 'other' })],
      inventory: [],
      benched: [withDetails('p2', 1, { card_unique_id: 'c' }), withDetails('p3', 1, { card_unique_id: 'c' })],
    } as unknown as DeckDTO
    expect(deckCopiesByZone(deck, 'c')).toEqual([
      { zone: 'maindeck', qty: 2, printingId: 'p1' },
      { zone: 'benched', qty: 2, printingId: 'p3' },
    ])
    expect(deckCopiesByZone(deck, 'missing')).toEqual([])
  })
})

describe('pitchSiblings', () => {
  it('returns every loaded card sharing the name, red → yellow → blue', () => {
    const cards = [
      { unique_id: 'b', name: 'Sink Below', pitch: 3 },
      { unique_id: 'x', name: 'Other', pitch: 1 },
      { unique_id: 'r', name: 'Sink Below', pitch: 1 },
      { unique_id: 'y', name: 'Sink Below', pitch: 2 },
    ]
    expect(pitchSiblings(cards, cards[0]).map(c => c.unique_id)).toEqual(['r', 'y', 'b'])
  })
})

describe('deckHeroName', () => {
  it("reads the hero card's name, falling back to the deck's heroName", () => {
    const withHero = { hero: [withDetails('h', 1, { display_name: "Maxx 'The Hype' Nitro", name: "maxx 'the hype' nitro" })], heroName: 'x' } as unknown as DeckDTO
    expect(deckHeroName(withHero)).toBe("Maxx 'The Hype' Nitro")
    expect(deckHeroName({ hero: [], heroName: 'Dash I/O' } as unknown as DeckDTO)).toBe('Dash I/O')
    expect(deckHeroName({ hero: [] } as unknown as DeckDTO)).toBeUndefined()
  })
})
