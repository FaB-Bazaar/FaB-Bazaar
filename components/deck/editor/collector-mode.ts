// Collector Mode helpers for DeckEditorListView.
// Pure functions so the filter/toast behavior is unit-testable outside
// the (very large) editor component.

export interface OwnershipLike {
  owned: number;
}

export interface OwnershipTile {
  printingId: string;
  copyIndex: number;
}

export interface OwnershipSection<T extends OwnershipTile = OwnershipTile> {
  key: string;
  tiles: T[];
}

function tileIsOwned(tile: OwnershipTile, ownershipMap: Map<string, OwnershipLike>): boolean {
  const own = ownershipMap.get(tile.printingId);
  return own ? tile.copyIndex < own.owned : false;
}

/**
 * Filter tile sections by ownership. Collector Mode ('unowned')
 * intentionally does NOT hide anything — it annotates: owned copies get
 * a binder-name link, unowned copies get add-to-binder/wants buttons.
 * Only the 'owned' filter actually removes tiles.
 */
export function filterSectionsByOwnership<S extends OwnershipSection>(
  sections: S[],
  filter: 'all' | 'owned' | 'unowned',
  ownershipMap: Map<string, OwnershipLike>
): S[] {
  if (filter !== 'owned') return sections;
  return sections
    .map(section => ({
      ...section,
      tiles: section.tiles.filter(tile => tileIsOwned(tile, ownershipMap)),
    }))
    .filter(section => section.key === 'hero' || section.tiles.length > 0);
}

/** Count copies across all sections that aren't covered by the binder ownership map. */
export function countUnownedTiles(
  sections: OwnershipSection[],
  ownershipMap: Map<string, OwnershipLike>
): number {
  let count = 0;
  for (const section of sections) {
    for (const tile of section.tiles) {
      if (!tileIsOwned(tile, ownershipMap)) count++;
    }
  }
  return count;
}

export interface WantsRowLike {
  /** card_unique_id of the wanted printing (the wants API calls it cardId) */
  cardId?: string;
  quantity?: number;
}

/**
 * Aggregate a wants list into card_unique_id → total quantity, summing
 * across printings (set/edition/foiling) of the same card. Rows without
 * a cardId are skipped; a missing/zero quantity counts as 1 (a wants row
 * always represents at least one wanted copy).
 */
export function buildWantsMap(rows?: WantsRowLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row.cardId) continue;
    const qty = row.quantity && row.quantity > 0 ? row.quantity : 1;
    map.set(row.cardId, (map.get(row.cardId) ?? 0) + qty);
  }
  return map;
}

/** Tooltip for the in-wants badge on an unowned Collector Mode tile. */
export function wantsBadgeTitle(cardName: string, quantity: number): string {
  return `${cardName} — ${quantity} ${quantity === 1 ? 'copy ' : 'copies '}already in your wants list (all printings). Click to add 1 more.`;
}

/** Toast content shown when Collector Mode is switched on. */
export function collectorModeToast(unownedCount: number): { title: string; description: string } {
  if (unownedCount === 0) {
    return {
      title: 'Collector Mode on',
      description: 'You already own every card in this deck — nothing to add.',
    };
  }
  return {
    title: 'Collector Mode on',
    description: `${unownedCount} card${unownedCount === 1 ? ' ' : 's '}in this deck ${
      unownedCount === 1 ? "isn't" : "aren't"
    } in your binder. 📖 adds one to your binder, ♥ adds it to your wants list.`,
  };
}
