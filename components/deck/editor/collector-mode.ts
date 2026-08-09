// Collector Mode helpers for DeckEditorListView.
// Pure functions so the filter/toast behavior is unit-testable outside
// the (very large) editor component.

export interface OwnershipLike {
  owned: number;
}

export interface OwnershipTile {
  printingId: string;
  copyIndex: number;
  /** card_unique_id — empty/missing falls back to exact-printing ownership */
  cardUniqueId?: string;
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
 * Hide the copies the user already owns at the CARD level (owning any
 * printing covers a slot) and keep only the still-missing copies. Owned
 * copies are allocated to tiles in render order, per card_unique_id, so a
 * partially-owned playset keeps exactly its shortage visible. Tiles
 * without a cardUniqueId fall back to exact-printing ownership.
 */
function hideCardOwnedTiles<S extends OwnershipSection>(
  sections: S[],
  ownershipMap: Map<string, OwnershipLike>,
  cardOwnershipMap: Map<string, OwnershipLike>
): S[] {
  const hiddenByCard = new Map<string, number>();
  return sections
    .map(section => ({
      ...section,
      tiles: section.tiles.filter(tile => {
        if (!tile.cardUniqueId) return !tileIsOwned(tile, ownershipMap);
        const owned = cardOwnershipMap.get(tile.cardUniqueId)?.owned ?? 0;
        const hidden = hiddenByCard.get(tile.cardUniqueId) ?? 0;
        if (hidden >= owned) return true;
        hiddenByCard.set(tile.cardUniqueId, hidden + 1);
        return false;
      }),
    }))
    .filter(section => section.key === 'hero' || section.tiles.length > 0);
}

/**
 * Filter tile sections by ownership.
 *
 * Collector Mode ('unowned') hides the copies you already own — at the
 * card level, any printing counts — and shows only what's missing, each
 * tile carrying its add-to-binder/wants buttons. Without a card-level
 * map (signed out / still loading) it falls back to annotate-only and
 * hides nothing. The 'owned' filter keeps only exactly-owned copies.
 */
export function filterSectionsByOwnership<S extends OwnershipSection>(
  sections: S[],
  filter: 'all' | 'owned' | 'unowned',
  ownershipMap: Map<string, OwnershipLike>,
  cardOwnershipMap?: Map<string, OwnershipLike>
): S[] {
  if (filter === 'unowned') {
    if (!cardOwnershipMap) return sections;
    return hideCardOwnedTiles(sections, ownershipMap, cardOwnershipMap);
  }
  if (filter !== 'owned') return sections;
  return sections
    .map(section => ({
      ...section,
      tiles: section.tiles.filter(tile => tileIsOwned(tile, ownershipMap)),
    }))
    .filter(section => section.key === 'hero' || section.tiles.length > 0);
}

/**
 * Count copies across all sections not covered by the user's collection.
 * With a card-level map, counts at the card level (any printing covers a
 * slot); otherwise counts exact-printing ownership.
 */
export function countUnownedTiles(
  sections: OwnershipSection[],
  ownershipMap: Map<string, OwnershipLike>,
  cardOwnershipMap?: Map<string, OwnershipLike>
): number {
  if (cardOwnershipMap) {
    return hideCardOwnedTiles(sections, ownershipMap, cardOwnershipMap)
      .reduce((sum, section) => sum + section.tiles.length, 0);
  }
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
    } in your binder — owned copies are hidden. 📖 adds one to your binder, ♥ adds it to your wants list.`,
  };
}
