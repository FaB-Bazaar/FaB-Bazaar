/**
 * Default maximum quantity per unique printing_id for bulk imports
 */
export const DEFAULT_MAX_QUANTITY_PER_PRINTING = 3;

/**
 * Cards that have no quantity limits
 */
export const UNLIMITED_QUANTITY_CARDS = new Set([
  'cracked bauble',
  'copper cog'
]);

/**
 * Check if a card has unlimited quantity allowed
 */
export function hasUnlimitedQuantity(cardName: string): boolean {
  const normalizedName = cardName.toLowerCase().trim();
  return UNLIMITED_QUANTITY_CARDS.has(normalizedName);
}

/**
 * Get the maximum allowed quantity for a card
 */
export function getMaxQuantityForCard(cardName: string): number {
  return hasUnlimitedQuantity(cardName) ? Infinity : DEFAULT_MAX_QUANTITY_PER_PRINTING;
}

/**
 * Validate if a quantity is allowed for a specific card
 */
export function isQuantityAllowed(cardName: string, quantity: number): boolean {
  if (quantity < 1) return false;

  const maxAllowed = getMaxQuantityForCard(cardName);
  return quantity <= maxAllowed;
}