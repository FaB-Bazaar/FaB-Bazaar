/**
 * Collapse a flat or card-grouped printings search response into the dialog's
 * CardResult rows (one per card), preserving the per-card printing order.
 *
 * Two response shapes feed this:
 *   • groupByCard search → one representative printing per card, each carrying
 *     `printing_count`. We surface that as `__printingsCount` so the tile shows
 *     the real count and the dialog lazy-loads the full printing list on click.
 *   • flat search (swap mode) → every printing inline; no printing_count, so
 *     __printingsCount stays undefined and the tile falls back to printings.length.
 */

import { sortPrintings } from '@/lib/fab-constants/sets';
import type { PrintingResult, CardResult } from '@/lib/client/hero-pool-cache';

export type CardResultWithCount = CardResult & { __printingsCount?: number };

export function groupSearchPrintingsToCards(printings: PrintingResult[]): CardResultWithCount[] {
  const map = new Map<string, CardResultWithCount>();

  for (const p of printings) {
    const id = (p.card_unique_id || p.cardId || p.display_name || p.name || '?') as string;
    if (!map.has(id)) {
      map.set(id, {
        unique_id: id,
        name: (p.display_name || p.name || 'Unknown') as string,
        types: ((p.types || []) as string[]).map(t => String(t).toLowerCase()),
        pitch: (p.pitch ?? null) as number | null,
        printings: [],
      });
    }
    const entry = map.get(id)!;
    entry.printings.push(p);

    // Grouped rows carry the true count on the representative; flat rows don't.
    const count = (p as { printing_count?: number }).printing_count;
    if (count != null) entry.__printingsCount = count;
  }

  // Keep carousel + default-selected printing in canonical order.
  for (const card of map.values()) {
    card.printings = sortPrintings(card.printings) as typeof card.printings;
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
