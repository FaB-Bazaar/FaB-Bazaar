import { describe, it, expect } from 'vitest'
import type { DeckDTO } from '@/lib/services/contracts/IDeckService'
import { buildDeckExportText } from './deck-export-text'

// Characterisation of the classic page's "Copy list" / "Export" text (moved
// here unchanged so deck v2's Options menu shares it).
describe('buildDeckExportText', () => {
  it('lists equipment, main deck and inventory as "N Name (pitch)", merging printings', () => {
    const deck = {
      hero: [{ printingId: 'h', quantity: 1, printingDetails: { display_name: 'Hero' } }],
      equipment: [{ printingId: 'e', quantity: 1, printingDetails: { display_name: 'Arcane Lantern' } }],
      maindeck: [
        { printingId: 'a', quantity: 2, printingDetails: { display_name: 'Mocking Blow', pitch: 1 } },
        { printingId: 'b', quantity: 1, printingDetails: { display_name: 'Mocking Blow', pitch: 1 } },
        { printingId: 'c', quantity: 3, printingDetails: { display_name: 'Mocking Blow', pitch: 3 } },
      ],
      inventory: [{ printingId: 'i', quantity: 1, printingDetails: { name: 'sink below', pitch: 2 } }],
      benched: [{ printingId: 'x', quantity: 1, printingDetails: { display_name: 'Not Exported' } }],
    } as unknown as DeckDTO
    expect(buildDeckExportText(deck)).toBe(['1 Arcane Lantern', '3 Mocking Blow (red)', '3 Mocking Blow (blu)', '1 sink below (yel)'].join('\n'))
  })
})
