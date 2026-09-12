// lib/browse/group-bulk-results.ts
//
// Pure grouping/merging for the /browse bulk import. Extracted from
// useBulkImportPage so it can be unit-tested (hooks/** has no vitest glob).
//
// A name line ("3 Snatch red") groups every printing of the resolved card into
// ONE row keyed by card_unique_id. A collector-number line ("2 WTR001") names a
// specific set printing, so it keys by card + collector number: "2 WTR001" and
// "1 1HP001" (both Rhinar) stay two rows with their own quantity and default.

import { selectDefaultPrinting } from '@/lib/browse/utils';
import type { ParsedCard } from '@/lib/browse/parsers/bulk-input-parser';

export interface BulkCardInstance {
  instanceId: string;
  mergeKey: string;
  card_unique_id: string;
  selectedPrinting: any;
  quantity: number;
  forTrade: boolean;
  allPrintings: any[];
  isStaged: boolean;
}

interface ResolvedLine {
  index: number;
  printings: any[];
}

export const bulkMergeKey = (cardUniqueId: string, collectorNumber?: string) =>
  `${cardUniqueId}|${collectorNumber ?? ''}`;

export function buildBulkCardInstances(
  parsedCards: ParsedCard[],
  results: ResolvedLine[],
  opts: { stageAll?: boolean } = {},
): BulkCardInstance[] {
  const groups = new Map<string, { cardUniqueId: string; quantity: number; printings: any[] }>();

  results.forEach((result, i) => {
    const line = parsedCards[i];
    if (!line || result.printings.length === 0) return;
    for (const printing of result.printings) {
      const cardUniqueId = printing.card_unique_id;
      if (!cardUniqueId) continue;
      const key = bulkMergeKey(cardUniqueId, line.collectorNumber);
      let group = groups.get(key);
      if (!group) {
        group = { cardUniqueId, quantity: line.quantity, printings: [] };
        groups.set(key, group);
      }
      group.printings.push(printing);
    }
  });

  return Array.from(groups.entries()).map(([mergeKey, group]) => ({
    instanceId: `${group.cardUniqueId}-${Date.now()}-${Math.random()}`,
    mergeKey,
    card_unique_id: group.cardUniqueId,
    selectedPrinting: selectDefaultPrinting({ printings: group.printings }),
    quantity: group.quantity,
    forTrade: false,
    allPrintings: group.printings,
    isStaged: opts.stageAll ?? false,
  }));
}

/**
 * Merge a fresh search into the current result list: staged rows are kept as
 * they are, an unstaged row with the same mergeKey absorbs the new quantity and
 * printing, everything else is appended. Staged rows sort first, then by name.
 */
export function mergeBulkInstances<T extends BulkCardInstance>(
  current: T[],
  incoming: T[],
): { results: T[]; addedCount: number; updatedCount: number } {
  const results: T[] = [...current];

  let addedCount = 0;
  let updatedCount = 0;

  for (const card of incoming) {
    const idx = results.findIndex(c => !c.isStaged && c.mergeKey === card.mergeKey);
    if (idx !== -1) {
      results[idx] = {
        ...results[idx],
        quantity: results[idx].quantity + card.quantity,
        selectedPrinting: card.selectedPrinting,
        allPrintings: card.allPrintings,
      };
      updatedCount++;
    } else {
      results.push(card);
      addedCount++;
    }
  }

  results.sort((a, b) => {
    if (a.isStaged && !b.isStaged) return -1;
    if (!a.isStaged && b.isStaged) return 1;
    return (a.selectedPrinting?.display_name || '').localeCompare(b.selectedPrinting?.display_name || '');
  });

  return { results, addedCount, updatedCount };
}
