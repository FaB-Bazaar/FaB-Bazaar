// lib/deck/present-sections.test.ts
//
// Section grouping for the deck present page, classified by card type (via
// classifyDeckZone) instead of the stored category. Repro: a Maxx deck with
// three base equipment rows stored as maindeck rendered them under "No Pitch".

import { describe, it, expect } from 'vitest'
import { buildPresentSections } from './present-sections'

const c = (name: string, types: string[], pitch: number | null = null) =>
  ({ printingId: name, quantity: 1, printingDetails: { display_name: name, types, pitch } }) as any

const names = (sections: ReturnType<typeof buildPresentSections>, key: string) =>
  sections.find((s) => s.key === key)?.cards.map((x: any) => x.printingId) ?? []

describe('buildPresentSections', () => {
  const hero = [c('Maxx', ['mechanologist', 'hero'])]
  const equipment = [
    c('Banksy', ['mechanologist', 'weapon', 'wrench', '2h']),
    c('Teklo Foundry Heart', ['mechanologist', 'equipment', 'chest']),
    c('Evo Circuit Breaker', ['mechanologist', 'instant', 'equipment', 'evo', 'head'], 1),
  ]
  const maindeck = [
    c('Zero to Sixty', ['mechanologist', 'action', 'attack'], 1),
    c('Hyper Driver', ['mechanologist', 'action', 'item'], 3),
    c('Galvanic Bender', ['mechanologist', 'equipment', 'arms'], 0),
    c('Cog in the Machine', ['mechanologist', 'action'], 0),
  ]
  const inventory = [c('Firewall', ['mechanologist', 'block'], 1)]

  it('base equipment stored as maindeck lands in Equipment & Weapons, not No Pitch', () => {
    const s = buildPresentSections({ hero, equipment, maindeck, inventory, includeInventory: true })
    expect(names(s, 'equipment')).toEqual(['Banksy', 'Teklo Foundry Heart', 'Galvanic Bender'])
    expect(names(s, 'no-pitch')).toEqual(['Cog in the Machine'])
  })

  it('evo equipment stored as equipment lands in its pitch column', () => {
    const s = buildPresentSections({ hero, equipment, maindeck, inventory, includeInventory: true })
    expect(names(s, 'red')).toEqual(['Zero to Sixty', 'Evo Circuit Breaker'])
    expect(names(s, 'blue')).toEqual(['Hyper Driver'])
  })

  it('hero and inventory sections, inventory omitted when a matchup is selected', () => {
    const withInv = buildPresentSections({ hero, equipment, maindeck, inventory, includeInventory: true })
    expect(names(withInv, 'hero')).toEqual(['Maxx'])
    expect(names(withInv, 'inventory')).toEqual(['Firewall'])
    const noInv = buildPresentSections({ hero, equipment, maindeck, inventory, includeInventory: false })
    expect(noInv.find((s) => s.key === 'inventory')).toBeUndefined()
  })

  it('drops empty sections and keeps the canonical order', () => {
    const s = buildPresentSections({ hero, equipment: [], maindeck: [c('Throttle', ['action'], 3)], inventory: [], includeInventory: true })
    expect(s.map((x) => x.key)).toEqual(['hero', 'blue'])
  })
})
