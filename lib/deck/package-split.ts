/**
 * Starter Kit / curated-list preview dialog: per-card allocation of copies
 * across Deck / Inventory / Bench, plus the ability to raise or lower the
 * TOTAL from the list's own quantity (3 Crankshaft → import 2, or 4).
 *
 * Bench is derived (total − deck − inventory), never stored. Framework-free so
 * it is unit-testable (app/decks has no vitest glob).
 */

export interface PackageSplit {
  deck: number;
  inventory: number;
  /** Copies to import in total; starts at the list quantity. */
  total: number;
}

export const defaultSplit = (qty: number): PackageSplit => ({ deck: qty, inventory: 0, total: qty });

export const benchQty = (s: PackageSplit): number => s.total - s.deck - s.inventory;

/** One more copy, placed in the deck. */
export const addCopy = (s: PackageSplit): PackageSplit => ({ ...s, deck: s.deck + 1, total: s.total + 1 });

/** One fewer copy — taken from the bench first, then inventory, then deck,
 *  so an explicit deck allocation survives as long as possible. */
export const removeCopy = (s: PackageSplit): PackageSplit => {
  if (s.total <= 0) return s;
  if (benchQty(s) > 0) return { ...s, total: s.total - 1 };
  if (s.inventory > 0) return { ...s, inventory: s.inventory - 1, total: s.total - 1 };
  return { ...s, deck: s.deck - 1, total: s.total - 1 };
};

export const allToDeck = (s: PackageSplit): PackageSplit => ({ deck: s.total, inventory: 0, total: s.total });
export const allToInventory = (s: PackageSplit): PackageSplit => ({ deck: 0, inventory: s.total, total: s.total });
export const allToBench = (s: PackageSplit): PackageSplit => ({ deck: 0, inventory: 0, total: s.total });

export type SplitItem = { printingId: string; quantity: number; category?: 'inventory' | 'benched' };

/** addPrintings payload for one card: one item per non-empty zone. */
export function splitToItems(printingId: string, s: PackageSplit): SplitItem[] {
  const items: SplitItem[] = [];
  if (s.deck > 0) items.push({ printingId, quantity: s.deck });
  if (s.inventory > 0) items.push({ printingId, quantity: s.inventory, category: 'inventory' });
  const bench = benchQty(s);
  if (bench > 0) items.push({ printingId, quantity: bench, category: 'benched' });
  return items;
}
