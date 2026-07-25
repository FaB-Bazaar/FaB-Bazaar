import type { DeckDTO, DeckPrintingDTO, DeckCategory } from '@/lib/services/contracts/IDeckService';

/**
 * Zone classification shared by the tiles view (via classifyTileCard) and the
 * deck-page stat chips. Classifies by card TYPES first, stored category
 * second — the same card counts the same way no matter how it was added
 * (the "Card category ≠ card type" gotcha: chord shortcuts can store
 * equipment-typed cards under maindeck).
 */
export type DeckZone = 'hero' | 'weapon' | 'equipment' | 'maindeck' | 'inventory' | 'bench';

export function classifyDeckZone(printing: DeckPrintingDTO, category: DeckCategory): DeckZone {
  const types = ((printing.printingDetails?.types as string[] | undefined) || []).map(t => t.toLowerCase());
  // Detect hero by DB category or by card type (guards against hero stored under maindeck)
  if (category === 'hero' || types.includes('hero')) return 'hero';
  if (category === 'inventory') return 'inventory';
  if (category === 'benched') return 'bench';
  const isEvo = types.some(t => t === 'evo');
  if (types.some(t => t === 'weapon')) return 'weapon';
  if (!isEvo && (types.some(t => t === 'equipment') || category === 'equipment')) return 'equipment';
  return 'maindeck';
}

export interface DeckSectionCounts {
  weapon: number;
  equipment: number;
  maindeck: number;
  inventory: number;
  bench: number;
}

export function computeDeckSectionCounts(deck: DeckDTO): DeckSectionCounts {
  const counts: DeckSectionCounts = { weapon: 0, equipment: 0, maindeck: 0, inventory: 0, bench: 0 };
  const add = (cards: DeckPrintingDTO[] | undefined, category: DeckCategory) => {
    for (const printing of cards ?? []) {
      const zone = classifyDeckZone(printing, category);
      if (zone === 'hero') continue;
      counts[zone] += printing.quantity ?? 1;
    }
  };
  add(deck.maindeck, 'maindeck');
  add(deck.equipment, 'equipment');
  add(deck.inventory, 'inventory');
  add(deck.benched, 'benched');
  return counts;
}
