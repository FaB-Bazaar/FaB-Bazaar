// Printing sort order utilities
// Provides consistent ordering for printings across the application

import { getSetCodesInDisplayOrder } from './fab-constants';

/**
 * Foiling display order.
 * Lower numbers appear first in sorted lists.
 * Order: Cold Foil → Rainbow Foil → Standard (non-foil)
 */
export const FOILING_DISPLAY_ORDER: Record<string, number> = {
  'c': 1,   // Cold Foil
  'g': 2,   // Gold Cold Foil
  'r': 3,   // Rainbow Foil
  's': 4,   // Standard (non-foil)
  'n': 4,   // Standard (non-foil, alternate code)
};

/**
 * Sort printings by set order (using set display order) and then by foiling.
 * Sets appear in: Standard sets (chronological) → Armory → Non-standard (GEM/FAB last)
 * Within same set: Cold Foil → Rainbow Foil → Standard
 *
 * @param printings - Array of printing objects with `set` and `foiling` properties
 * @returns Sorted array of printings
 *
 * @example
 * const printings = [
 *   { set: 'FAB', foiling: 's', ... },
 *   { set: 'WTR', foiling: 'c', ... },
 *   { set: 'WTR', foiling: 's', ... },
 * ];
 * const sorted = sortPrintingsBySetAndFoiling(printings);
 * // Result: WTR cold foil → WTR standard → FAB standard
 */
export function sortPrintingsBySetAndFoiling<T extends { set?: string; foiling?: string }>(
  printings: T[]
): T[] {
  const setOrder = getSetCodesInDisplayOrder();

  return printings.sort((a, b) => {
    // First: sort by set using display order
    const setOrderA = setOrder.indexOf(a.set?.toLowerCase() || '');
    const setOrderB = setOrder.indexOf(b.set?.toLowerCase() || '');

    // If set not found in order, put at end
    const finalSetOrderA = setOrderA === -1 ? 999 : setOrderA;
    const finalSetOrderB = setOrderB === -1 ? 999 : setOrderB;

    if (finalSetOrderA !== finalSetOrderB) {
      return finalSetOrderA - finalSetOrderB;
    }

    // Then: sort by foiling within same set
    const foilingA = FOILING_DISPLAY_ORDER[a.foiling?.toLowerCase() || ''] || 999;
    const foilingB = FOILING_DISPLAY_ORDER[b.foiling?.toLowerCase() || ''] || 999;
    return foilingA - foilingB;
  });
}

/**
 * Get foiling display priority (lower = appears first).
 * Useful for custom sorting logic.
 *
 * @param foiling - Foiling code (e.g., 'c', 'r', 's')
 * @returns Priority number (1-4), or 999 for unknown foiling
 */
export function getFoilingPriority(foiling: string | undefined): number {
  if (!foiling) return 999;
  return FOILING_DISPLAY_ORDER[foiling.toLowerCase()] || 999;
}

/**
 * Get set display priority (lower = appears first).
 * Useful for custom sorting logic.
 *
 * @param setCode - Set code (e.g., 'WTR', 'FAB')
 * @returns Priority number (0-based index), or 999 for unknown sets
 */
export function getSetPriority(setCode: string | undefined): number {
  if (!setCode) return 999;
  const setOrder = getSetCodesInDisplayOrder();
  const priority = setOrder.indexOf(setCode.toLowerCase());
  return priority === -1 ? 999 : priority;
}
