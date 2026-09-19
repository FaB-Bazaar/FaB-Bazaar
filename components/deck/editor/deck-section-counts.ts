import type { DeckDTO, DeckPrintingDTO, DeckCategory } from '@/lib/services/contracts/IDeckService';

// classifyDeckZone moved to lib/deck/classify-deck-zone.ts so the present page
// and the deck service can share it; re-exported here for existing importers.
export { classifyDeckZone } from '@/lib/deck/classify-deck-zone';
export type { DeckZone } from '@/lib/deck/classify-deck-zone';
import { classifyDeckZone } from '@/lib/deck/classify-deck-zone';

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
