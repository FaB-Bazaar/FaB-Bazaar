/**
 * Pure split logic for the Starter Kit / curated-list preview dialog: how one
 * card's copies are allocated across Deck / Inventory / Bench, and how the
 * TOTAL can be raised or lowered from the list's quantity ("3 Crankshaft" →
 * import 2, or 4).
 */
import { describe, it, expect } from 'vitest';
import {
  defaultSplit, benchQty, addCopy, removeCopy,
  allToDeck, allToInventory, allToBench, splitToItems,
} from './package-split';

describe('package split — allocation', () => {
  it('defaults every copy to the deck with the list quantity as the total', () => {
    expect(defaultSplit(3)).toEqual({ deck: 3, inventory: 0, total: 3 });
    expect(benchQty(defaultSplit(3))).toBe(0);
  });

  it('bench is whatever the deck and inventory rows do not claim', () => {
    expect(benchQty({ deck: 1, inventory: 1, total: 3 })).toBe(1);
  });

  it('set-all moves keep the current total, not the list quantity', () => {
    const s = { deck: 1, inventory: 1, total: 4 };
    expect(allToDeck(s)).toEqual({ deck: 4, inventory: 0, total: 4 });
    expect(allToInventory(s)).toEqual({ deck: 0, inventory: 4, total: 4 });
    expect(allToBench(s)).toEqual({ deck: 0, inventory: 0, total: 4 });
  });
});

describe('package split — changing the total', () => {
  it('addCopy raises the total and puts the new copy in the deck', () => {
    expect(addCopy({ deck: 3, inventory: 0, total: 3 })).toEqual({ deck: 4, inventory: 0, total: 4 });
    expect(addCopy({ deck: 0, inventory: 2, total: 3 })).toEqual({ deck: 1, inventory: 2, total: 4 });
  });

  it('removeCopy takes from the bench first, then inventory, then deck', () => {
    expect(removeCopy({ deck: 1, inventory: 1, total: 3 })).toEqual({ deck: 1, inventory: 1, total: 2 }); // bench 1 → 0
    expect(removeCopy({ deck: 1, inventory: 1, total: 2 })).toEqual({ deck: 1, inventory: 0, total: 1 });
    expect(removeCopy({ deck: 1, inventory: 0, total: 1 })).toEqual({ deck: 0, inventory: 0, total: 0 });
  });

  it('removeCopy at zero is a no-op (never negative)', () => {
    expect(removeCopy({ deck: 0, inventory: 0, total: 0 })).toEqual({ deck: 0, inventory: 0, total: 0 });
  });
});

describe('splitToItems — the addPrintings payload', () => {
  it('emits one item per non-empty zone, deck items without a category', () => {
    expect(splitToItems('p1', { deck: 2, inventory: 1, total: 4 })).toEqual([
      { printingId: 'p1', quantity: 2 },
      { printingId: 'p1', quantity: 1, category: 'inventory' },
      { printingId: 'p1', quantity: 1, category: 'benched' },
    ]);
  });

  it('emits nothing for a card whose total was reduced to zero', () => {
    expect(splitToItems('p1', { deck: 0, inventory: 0, total: 0 })).toEqual([]);
  });
});
