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
 * Append a fresh search to the current result list. A repeated search for a
 * card already listed adds a NEW row (the user may want a different foiling on
 * the second pass); rows are only folded together when staged, by printing
 * (see stageBulkInstance). Staged rows sort first, then by name.
 */
export function mergeBulkInstances<T extends BulkCardInstance>(
  current: T[],
  incoming: T[],
): { results: T[]; addedCount: number } {
  const results = [...current, ...incoming];
  results.sort((a, b) => {
    if (a.isStaged && !b.isStaged) return -1;
    if (!a.isStaged && b.isStaged) return 1;
    return (a.selectedPrinting?.display_name || '').localeCompare(b.selectedPrinting?.display_name || '');
  });
  return { results, addedCount: incoming.length };
}

/**
 * Toggle a row's staged state. Staging a row whose selected printing is already
 * staged folds it into that row (quantities add) so the import never carries
 * the same printing twice; unstaging just flips the flag.
 */
export function stageBulkInstance<T extends BulkCardInstance>(current: T[], instanceId: string): T[] {
  const row = current.find(c => c.instanceId === instanceId);
  if (!row) return current;

  if (row.isStaged) {
    return current.map(c => (c.instanceId === instanceId ? { ...c, isStaged: false } : c));
  }

  const printingId = row.selectedPrinting?.printing_id;
  const target = current.find(
    c => c.isStaged && c.instanceId !== instanceId && printingId && c.selectedPrinting?.printing_id === printingId,
  );
  if (!target) {
    return current.map(c => (c.instanceId === instanceId ? { ...c, isStaged: true } : c));
  }

  return current
    .filter(c => c.instanceId !== instanceId)
    .map(c => (c.instanceId === target.instanceId ? { ...c, quantity: c.quantity + row.quantity } : c));
}
