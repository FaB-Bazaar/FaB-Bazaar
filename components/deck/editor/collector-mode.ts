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
 * Filter tile sections by ownership. Under the 'unowned' filter,
 * printings in `exemptIds` stay visible even once owned — this is what
 * keeps a card on screen (with its green dot) right after the user adds
 * it to a binder, instead of vanishing from the deck view.
 */
export function filterSectionsByOwnership<S extends OwnershipSection>(
  sections: S[],
  filter: 'all' | 'owned' | 'unowned',
  ownershipMap: Map<string, OwnershipLike>,
  exemptIds?: Set<string>
): S[] {
  if (filter === 'all') return sections;
  return sections
    .map(section => ({
      ...section,
      tiles: section.tiles.filter(tile => {
        if (filter === 'unowned' && exemptIds?.has(tile.printingId)) return true;
        const isOwned = tileIsOwned(tile, ownershipMap);
        return filter === 'owned' ? isOwned : !isOwned;
      }),
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
