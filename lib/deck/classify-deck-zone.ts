// lib/deck/classify-deck-zone.ts
//
// ONE rule for "which zone does this card belong to". Classifies by card TYPES
// first and the stored deck_cards.category second, so the same card lands in
// the same place no matter how it was added (chord shortcuts, the MCP tool and
// the API routes have all stored equipment-typed cards under maindeck).
//
// Evo equipment is the deliberate exception: it has a pitch and is played from
// the deck, so it is a library card even though its types include "equipment".
//
// Used by the editor (tiles, list/game view, stat chips), the present page and,
// via inferDeckCategory, the deck service when a caller names no zone.

import type { DeckCategory, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'

export type DeckZone = 'hero' | 'weapon' | 'equipment' | 'maindeck' | 'inventory' | 'bench'

function lowerTypes(types: unknown): string[] {
  return (Array.isArray(types) ? types : []).map((t) => String(t).toLowerCase())
}

export function classifyDeckZone(printing: DeckPrintingDTO, category: DeckCategory): DeckZone {
  const types = lowerTypes(printing.printingDetails?.types)
  // Detect hero by DB category or by card type (guards against hero stored under maindeck)
  if (category === 'hero' || types.includes('hero')) return 'hero'
  if (category === 'inventory') return 'inventory'
  if (category === 'benched') return 'bench'
  const isEvo = types.includes('evo')
  if (types.includes('weapon')) return 'weapon'
  if (!isEvo && (types.includes('equipment') || category === 'equipment')) return 'equipment'
  return 'maindeck'
}

/**
 * The deck_cards.category to store for a card when the caller did not name
 * one. Same rule as classifyDeckZone without a stored category to fall back on.
 */
export function inferDeckCategory(types: unknown): DeckCategory {
  const t = lowerTypes(types)
  if (t.includes('hero')) return 'hero'
  if (t.includes('weapon')) return 'equipment'
  if (t.includes('equipment') && !t.includes('evo')) return 'equipment'
  return 'maindeck'
}
