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
import type { PrintCodeImportRow } from '@/lib/import/print-code-import';

export interface BulkCardInstance {
  instanceId: string;
  mergeKey: string;
  card_unique_id: string;
  selectedPrinting: any;
  quantity: number;
  forTrade: boolean;
  allPrintings: any[];
  isStaged: boolean;
  /** NM/LP/MP/HP/DMG — set by the CSV import; absent = NM */
  condition?: string;
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
  const condition = row.condition ?? 'NM';
  const target = current.find(
    c => c.isStaged && c.instanceId !== instanceId && printingId &&
      c.selectedPrinting?.printing_id === printingId && (c.condition ?? 'NM') === condition,
  );
  if (!target) {
    return current.map(c => (c.instanceId === instanceId ? { ...c, isStaged: true } : c));
  }

  return current
    .filter(c => c.instanceId !== instanceId)
    .map(c => (c.instanceId === target.instanceId ? { ...c, quantity: c.quantity + row.quantity } : c));
}

/**
 * Rows from the print-code CSV import (lib/import/print-code-import.ts). The
 * code names one exact printing, so an 'ok' row arrives staged on it with the
 * file's quantity/condition/trade flag; a 'not_sure' row arrives unstaged with
 * every candidate printing for the user to check. Unresolved rows and rows
 * with only a wants quantity don't become tiles.
 */
export function buildCsvImportInstances(rows: PrintCodeImportRow[]): BulkCardInstance[] {
  return rows
    .filter(r => r.status !== 'unresolved' && r.printing && r.quantity > 0)
    .map(r => {
      const printing = r.printing!;
      const allPrintings = r.candidates && r.candidates.length > 0 ? r.candidates : [printing];
      return {
        instanceId: `csv-${r.line}-${printing.printing_id}-${Math.random()}`,
        mergeKey: bulkMergeKey(printing.card_unique_id, printing.collector_number),
        card_unique_id: printing.card_unique_id,
        selectedPrinting: printing,
        quantity: r.quantity,
        forTrade: r.forTrade,
        condition: r.condition,
        allPrintings,
        isStaged: r.status === 'ok',
      };
    });
}

/** Wants from the CSV's sure rows, one entry per printing. */
export function csvImportWants(rows: PrintCodeImportRow[]): Array<{ printingId: string; quantity: number }> {
  const byPrinting = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== 'ok' || !r.printing || r.wantsQuantity <= 0) continue;
    const id = r.printing.printing_id;
    byPrinting.set(id, (byPrinting.get(id) ?? 0) + r.wantsQuantity);
  }
  return [...byPrinting].map(([printingId, quantity]) => ({ printingId, quantity }));
}
