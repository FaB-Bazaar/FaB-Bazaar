/**
 * Pure transform from the inventory-comparison DTO to the per-printing
 * ownership map the playmat zone overlay renders (Owned / Partial / Missing
 * badges). Kept separate from PlaymatView so the shape mapping is
 * unit-testable against the real service contract.
 */

import type { InventoryComparisonDTO } from '@/lib/services/contracts/IDeckService';

export interface OwnershipEntry {
  owned: number;
  needed: number;
  binderNames: string[];
  /** Not provided by the comparison endpoint today — consumers must treat
   * absence as "unknown", not "false"/empty. */
  alternative?: number;
  forTrade?: boolean;
  inventoryItemIds?: string[];
  binderSlugs?: string[];
  binderIds?: string[];
}

export function buildOwnershipMap(
  comparison: InventoryComparisonDTO
): Map<string, OwnershipEntry> {
  const map = new Map<string, OwnershipEntry>();

  for (const card of comparison.owned ?? []) {
    map.set(card.printingId, {
      owned: card.owned,
      needed: card.needed,
      binderNames: card.binderNames ?? [],
    });
  }

  for (const card of comparison.partial ?? []) {
    map.set(card.printingId, {
      owned: card.owned,
      needed: card.needed,
      binderNames: [],
    });
  }

  for (const card of comparison.missing ?? []) {
    map.set(card.printingId, {
      owned: 0,
      needed: card.needed,
      binderNames: [],
    });
  }

  return map;
}
