import { Card, CardMatch } from './types';

/**
 * Extracts a consistent printing ID from various card data structures
 * Much simpler now with InventoryItem structure, but keeps backward compatibility
 */
export function extractPrintingId(card: Card): string | null {
  // With InventoryItems, printingId should be directly available
  // Keep fallbacks for wants list cards that might use legacy structure
  const id = card.printingId || 
             card.printingDetails?.printing_id || 
             card.printingDetails?.printingId ||
             card.id ||
             null;
  
  // Ensure we return null for invalid IDs
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return null;
  }
  
  return id.trim();
}

/**
 * Safely extracts the market value of a card from various possible locations
 * Simplified for InventoryItem structure but maintains backward compatibility
 */
export function getCardValue(card: Card): number {
  // With InventoryItems, pricing should be directly available
  // Prioritize tcg_market as it's most commonly used for trade values
  const possiblePrices = [
    // Primary: Direct fields from InventoryItem (denormalized from printings_core)
    card.tcg_market,
    card.tcg_low,
    card.tcg_mid,
    card.tcg_high,
    
    // Fallback: Legacy printingDetails structure (for wants lists)
    card.printingDetails?.tcg_market,
    card.printingDetails?.tcgMarket,
    card.printingDetails?.tcg_low,
    card.printingDetails?.tcgLow,
    card.priceInfo?.tcgMarket,
    card.priceInfo?.tcgLow
  ];

  for (const price of possiblePrices) {
    if (price !== undefined && price !== null) {
      const numericPrice = Number(price);
      if (!isNaN(numericPrice) && numericPrice >= 0) {
        return numericPrice;
      }
    }
  }

  return 0;
}

/**
 * Extracts the image URL from a card, checking multiple possible locations
 * Simplified for InventoryItem structure
 */
export function getCardImageUrl(primary: Card, fallback?: Card): string | null {
  // With InventoryItems, image_url should be directly available
  const url = primary.image_url ||
              primary.printingDetails?.image_url || 
              fallback?.image_url ||
              fallback?.printingDetails?.image_url ||
              null;
  
  // Validate URL format
  if (url && typeof url === 'string' && url.trim() !== '') {
    return url.trim();
  }
  
  return null;
}

/**
 * Gets the quantity of a card, defaulting to 1 if not specified
 */
export function getCardQuantity(card: Card): number {
  const qty = card.quantity;
  if (qty === undefined || qty === null) {
    return 1;
  }
  const numQty = Number(qty);
  return !isNaN(numQty) && numQty > 0 ? Math.floor(numQty) : 1;
}

/**
 * Gets the display name for a card, preferring display_name over name
 * Updated for InventoryItem structure
 */
export function getCardDisplayName(card: Card): string {
  return card.display_name || 
         card.name || 
         card.printingDetails?.name ||
         'Unknown Card';
}

/**
 * Creates a CardMatch object from card data
 * Updated to include color field and use InventoryItem structure
 */
export function createCardMatch(
  card: Card,
  matchingCards: Card[],
  totalQuantity: number
): CardMatch {
  const unitValue = getCardValue(matchingCards[0]);
  const firstMatch = matchingCards[0];
  
  return {
    name: getCardDisplayName(card) || getCardDisplayName(firstMatch),
    printingId: extractPrintingId(card) || '',
    set: card.set || firstMatch.set || firstMatch.printingDetails?.set_id,
    foiling: card.foiling || firstMatch.foiling || firstMatch.printingDetails?.foiling,
    edition: card.edition || firstMatch.edition || firstMatch.printingDetails?.edition,
    rarity: card.rarity || firstMatch.rarity || firstMatch.printingDetails?.rarity,
    color: card.color || firstMatch.color, // NEW: Include color information
    quantity: totalQuantity,
    unitValue: unitValue,
    totalValue: unitValue * totalQuantity,
    image_url: getCardImageUrl(card, firstMatch)
  };
}