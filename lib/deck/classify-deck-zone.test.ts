// lib/deck/classify-deck-zone.test.ts
//
// One rule for "which zone does this card belong to", derived from the card's
// types rather than the stored deck_cards.category. The editor already used it
// (it lived in components/deck/editor/deck-section-counts.ts); the present page
// trusted the stored category and showed base equipment under "No Pitch".

import { describe, it, expect } from 'vitest'
import { classifyDeckZone, inferDeckCategory } from './classify-deck-zone'

const card = (types: string[], category: 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'benched' | 'tokens' = 'maindeck') =>
  ({ printingId: 'p', quantity: 1, category, printingDetails: { types } }) as any

describe('classifyDeckZone', () => {
  it('base equipment stored as maindeck is still equipment', () => {
    expect(classifyDeckZone(card(['mechanologist', 'equipment', 'arms'], 'maindeck'), 'maindeck')).toBe('equipment')
  })
  it('evo equipment is a library card even when stored as equipment', () => {
    expect(classifyDeckZone(card(['mechanologist', 'instant', 'equipment', 'evo', 'head'], 'equipment'), 'equipment')).toBe('maindeck')
  })
  it('weapons are their own zone', () => {
    expect(classifyDeckZone(card(['mechanologist', 'weapon', 'wrench', '2h'], 'equipment'), 'equipment')).toBe('weapon')
  })
  it('a hero stored under maindeck is still the hero', () => {
    expect(classifyDeckZone(card(['mechanologist', 'hero'], 'maindeck'), 'maindeck')).toBe('hero')
  })
  it('inventory and bench win over card type', () => {
    expect(classifyDeckZone(card(['mechanologist', 'equipment', 'legs'], 'inventory'), 'inventory')).toBe('inventory')
    expect(classifyDeckZone(card(['mechanologist', 'equipment', 'legs'], 'benched'), 'benched')).toBe('bench')
  })
})

describe('inferDeckCategory (write-time default when the caller names no zone)', () => {
  it('hero → hero', () => expect(inferDeckCategory(['mechanologist', 'hero'])).toBe('hero'))
  it('base equipment → equipment', () => expect(inferDeckCategory(['mechanologist', 'equipment', 'base', 'head'])).toBe('equipment'))
  it('weapon → equipment', () => expect(inferDeckCategory(['mechanologist', 'weapon', 'wrench', '2h'])).toBe('equipment'))
  it('evo equipment → maindeck', () => expect(inferDeckCategory(['mechanologist', 'instant', 'equipment', 'evo', 'head'])).toBe('maindeck'))
  it('action → maindeck', () => expect(inferDeckCategory(['mechanologist', 'action', 'attack'])).toBe('maindeck'))
  it('case-insensitive', () => expect(inferDeckCategory(['Mechanologist', 'Equipment', 'Chest'])).toBe('equipment'))
  it('no types → maindeck', () => expect(inferDeckCategory(undefined)).toBe('maindeck'))
})
