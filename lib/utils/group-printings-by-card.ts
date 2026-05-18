/**
 * Group a flat list of printings by `card_unique_id` into one entry per
 * logical card. Each group exposes a `canonicalPrinting` — the printing
 * that should represent the card in a one-tile-per-card display.
 *
 * Canonical pick order:
 *   1. English over non-English (via `sortPrintingsByLanguage`)
 *   2. Earliest set in display order (Standard sets chronologically →
 *      Armory → GEM/FAB last, via `sortPrintingsBySetAndFoiling`)
 *   3. Within the same set: Cold Foil → Rainbow Foil → Standard
 */

import { sortPrintingsBySetAndFoiling } from '../printing-sort-order';
import { sortPrintingsByLanguage } from './printing-language';

export interface CardGroup<T> {
  card_unique_id: string;
  canonicalPrinting: T;
  allPrintings: T[];
  count: number;
}

type Groupable = {
  card_unique_id?: string | null;
  set?: string;
  foiling?: string;
  language?: string | null;
};

export function groupPrintingsByCard<T extends Groupable>(printings: T[]): CardGroup<T>[] {
  if (printings.length === 0) return [];

  // Preserve first-seen card_unique_id order. Map iteration order is insertion order in ES2015+.
  const byCard = new Map<string, T[]>();
  for (const p of printings) {
    const id = p.card_unique_id;
    if (!id) continue;
    let arr = byCard.get(id);
    if (!arr) {
      arr = [];
      byCard.set(id, arr);
    }
    arr.push(p);
  }

  const result: CardGroup<T>[] = [];
  byCard.forEach((group, cardId) => {
    // Apply both sorts. Stable sort means language order wins on ties,
    // then within each language the set+foiling order applies.
    const sorted = sortPrintingsByLanguage(sortPrintingsBySetAndFoiling([...group]));
    result.push({
      card_unique_id: cardId,
      canonicalPrinting: sorted[0],
      allPrintings: group,
      count: group.length,
    });
  });

  return result;
}
