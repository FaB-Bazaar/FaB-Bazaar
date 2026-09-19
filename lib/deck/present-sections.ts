// lib/deck/present-sections.ts
//
// Section grouping for the deck present page. Cards are placed by
// classifyDeckZone (card types first), NOT by the stored category: a Maxx deck
// with three base-equipment rows stored under maindeck rendered them in
// "Library — No Pitch" while the editor, which already classified by type,
// showed them under Equipment.

import { classifyDeckZone } from './classify-deck-zone'

export interface PresentSectionCard {
  printingId: string
  quantity: number
  printingDetails?: { pitch?: number | null; types?: string[] } & Record<string, unknown>
}

export interface PresentSection<C extends PresentSectionCard = PresentSectionCard> {
  key: 'hero' | 'equipment' | 'red' | 'yellow' | 'blue' | 'no-pitch' | 'inventory'
  title: string
  accent: string
  cards: C[]
}

export function buildPresentSections<C extends PresentSectionCard>(input: {
  hero: C[]
  equipment: C[]
  maindeck: C[]
  inventory: C[]
  includeInventory: boolean
}): PresentSection<C>[] {
  const hero: C[] = []
  const equipment: C[] = []
  const inventory: C[] = []
  // Library keeps the maindeck's own order first; evo equipment re-homed from
  // the equipment zone follows (same order the editor's game view uses).
  const libraryFromMaindeck: C[] = []
  const libraryFromEquipment: C[] = []

  const place = (cards: C[], category: 'hero' | 'equipment' | 'maindeck' | 'inventory', library: C[]) => {
    for (const card of cards) {
      const zone = classifyDeckZone(card as never, category)
      if (zone === 'hero') hero.push(card)
      else if (zone === 'weapon' || zone === 'equipment') equipment.push(card)
      else if (zone === 'inventory' || zone === 'bench') inventory.push(card)
      else library.push(card)
    }
  }
  place(input.hero, 'hero', libraryFromMaindeck)
  place(input.equipment, 'equipment', libraryFromEquipment)
  place(input.maindeck, 'maindeck', libraryFromMaindeck)
  place(input.inventory, 'inventory', libraryFromMaindeck)
  const library = [...libraryFromMaindeck, ...libraryFromEquipment]

  const byPitch = (p: number) => library.filter((c) => c.printingDetails?.pitch === p)
  const noPitch = library.filter((c) => !c.printingDetails?.pitch)

  const result: PresentSection<C>[] = [
    { key: 'hero', title: 'Hero', accent: 'text-amber-300', cards: hero },
    { key: 'equipment', title: 'Equipment & Weapons', accent: 'text-gray-300', cards: equipment },
    { key: 'red', title: 'Library — Red', accent: 'text-red-400', cards: byPitch(1) },
    { key: 'yellow', title: 'Library — Yellow', accent: 'text-yellow-400', cards: byPitch(2) },
    { key: 'blue', title: 'Library — Blue', accent: 'text-blue-400', cards: byPitch(3) },
    { key: 'no-pitch', title: 'Library — No Pitch', accent: 'text-gray-400', cards: noPitch },
  ]
  if (input.includeInventory) {
    result.push({ key: 'inventory', title: 'Inventory', accent: 'text-gray-300', cards: inventory })
  }
  return result.filter((s) => s.cards.length > 0)
}
