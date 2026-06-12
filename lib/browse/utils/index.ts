// lib/browse/utils/index.ts

import { SET_MAP, FOILING_MAP, RARITY_MAP, EDITION_MAP } from "@/lib/fab-constants"

/**
 * Selects the best printing for a card based on language, edition, foiling, and price priority
 * Language: English always wins when an English printing exists (missing language = English)
 * Priority: Normal edition > Unlimited > First edition
 * Foiling: Standard > Rainbow > Cold foil
 * Within same tier, highest tcg_low price wins
 */
export function selectDefaultPrinting(card: any): any | null {
  let printings = card.printings || [card];

  if (printings.length === 0) return null;

  // Never default to a localized printing when an English one exists
  const englishPrintings = printings.filter(
    (p: any) => (p.language || 'en').toLowerCase() === 'en'
  );
  if (englishPrintings.length > 0) printings = englishPrintings;

  // Filter by edition and foiling priority
  const candidates = printings.filter((p: any) => {
    const edition = p.edition;
    const foiling = p.foiling;
    
    // Edition priority: n → u → f
    if (!['n', 'u', 'f', 'a'].includes(edition)) return false;
    
    // Foiling priority: s → r → c  
    if (!['s', 'r', 'c'].includes(foiling)) return false;
    
    return true;
  });
  
  if (candidates.length === 0) return null;
  
  // Sort by edition priority, then foiling priority
  candidates.sort((a: any, b: any) => {
    const editionPriority = { 'n': 0, 'u': 1, 'f': 2 };
    const foilingPriority = { 's': 0, 'r': 1, 'c': 2 };
    
    const editionDiff = editionPriority[a.edition] - editionPriority[b.edition];
    if (editionDiff !== 0) return editionDiff;
    
    return foilingPriority[a.foiling] - foilingPriority[b.foiling];
  });
  
  // Among top priority candidates, select highest tcg_low
  const topPriority = candidates.filter((p: any) => 
    p.edition === candidates[0].edition && p.foiling === candidates[0].foiling
  );
  
  const withPrices = topPriority.filter((p: any) => p.tcg_low != null);
  
  if (withPrices.length > 0) {
    return withPrices.reduce((max: any, current: any) => 
      current.tcg_low > max.tcg_low ? current : max
    );
  }
  
  // Fallback: first normal edition, then first in results
  return topPriority.find((p: any) => p.edition === 'n') || topPriority[0];
}

/**
 * Gets human-readable display information for a card printing
 */
export function getDisplayInfo(card: any) {
  return {
    setName: SET_MAP[card.set as keyof typeof SET_MAP] || card.set?.toUpperCase() || 'Unknown Set',
    foilingName: FOILING_MAP[card.foiling as keyof typeof FOILING_MAP] || card.foiling || 'Unknown Foiling',
    rarityName: RARITY_MAP[card.rarity as keyof typeof RARITY_MAP] || card.rarity?.toUpperCase() || 'Unknown Rarity',
    editionName: EDITION_MAP[card.edition as keyof typeof EDITION_MAP] || card.edition?.toUpperCase() || 'Unknown Edition',
    price: card.tcg_market ? `$${card.tcg_market.toFixed(2)}` : 'No price'
  };
}

/**
 * Generates a default binder name with current timestamp
 */
export function getDefaultBinderName(): string {
  const now = new Date();
  return `Bulk Import - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Generates a default deck name with current date
 */
export function getDefaultDeckName(): string {
  const now = new Date();
  return `Imported Deck - ${now.toLocaleDateString()}`;
}

/**
 * Groups bulk results by card name and color combination to handle duplicates
 */
export function groupBulkResultsByCard(bulkResults: any[]): Map<string, any[]> {
  const cardGroups = new Map<string, any[]>();
  
  for (const card of bulkResults) {
    // Create unique key using name and color
    const key = `${card.name.toLowerCase()}|${card.color || ""}`;
    
    if (!cardGroups.has(key)) {
      cardGroups.set(key, []);
    }
    cardGroups.get(key)!.push(card);
  }
  
  return cardGroups;
}

/**
 * Processes bulk results for quick add functionality
 * Returns processed and skipped card information
 */
export function processBulkResultsForQuickAdd(bulkResults: any[]): {
  processed: { name: string; quantity: number; color: string }[];
  skipped: string[];
} {
  const cardGroups = groupBulkResultsByCard(bulkResults);
  const processed = [];
  const skipped = [];
  
  for (const [key, cardGroup] of cardGroups) {
    const representativeCard = cardGroup[0];
    
    // Create a mock card object with all available printings for selection
    const cardWithPrintings = {
      ...representativeCard,
      printings: cardGroup.map(c => c.defaultPrinting || c).filter(Boolean)
    };
    
    // Select the best printing
    const selectedPrinting = selectDefaultPrinting(cardWithPrintings);
    
    if (!selectedPrinting) {
      skipped.push(representativeCard.name);
      continue;
    }
    
    processed.push({ 
      name: representativeCard.name, 
      quantity: representativeCard.importQuantity || 1,
      color: representativeCard.color || ""
    });
  }
  
  return { processed, skipped };
}

/**
 * Validates if a card has the minimum required fields for import
 */
export function isValidCardForImport(card: any): boolean {
  return !!(
    card && 
    (card.card_unique_id || card.cardId || card.unique_id) &&
    (card.display_name || card.name)
  );
}

/**
 * Validates if a printing has the minimum required fields for import
 */
export function isValidPrintingForImport(printing: any): boolean {
  return !!(
    printing && 
    (printing.printing_id || printing.unique_id)
  );
}

/**
 * Creates a standardized pending import card object
 */
export function createPendingImportCard(card: any, printing: any, quantity: number) {
  if (!isValidCardForImport(card) || !isValidPrintingForImport(printing)) {
    throw new Error('Invalid card or printing data for import');
  }

  const cardId = card.card_unique_id || card.cardId || card.unique_id;
  const printingId = printing.printing_id || printing.unique_id;

  return {
    id: printingId,
    cardId: cardId,
    name: card.display_name || card.name,
    quantity: quantity,
    printingId: printingId,
    printingDetails: { ...printing },
    set: printing?.set_id || printing?.set,
    rarity: printing?.rarity,
    foiling: printing?.foiling
  };
}

/**
 * Calculates total quantity across all pending import cards
 */
export function calculateTotalQuantity(pendingImport: any[]): number {
  return pendingImport.reduce((sum, card) => sum + (card.quantity || 1), 0);
}

/**
 * Deduplicates parsed cards by name and color, summing quantities
 */
export function deduplicateParsedCards(parsed: { name: string; quantity?: number; color?: string }[]) {
  const cardMap = new Map();
  
  for (const card of parsed) {
    const key = `${card.name.toLowerCase()}|${card.color || ""}`;
    const existing = cardMap.get(key);
    
    if (existing) {
      existing.quantity += card.quantity || 1;
    } else {
      cardMap.set(key, { ...card });
    }
  }
  
  return Array.from(cardMap.values());
}


// This file contains only pure, client-safe helper functions.

export function recalculateRarityCounts(cards: any[]) {
  const counts = { C: 0, R: 0, S: 0, M: 0, L: 0, F: 0, T: 0, B: 0, V: 0, P: 0 };
  for (const card of cards) {
    const rarity = (card.rarity || card.printingDetails?.rarity)?.toUpperCase();
    const qty = typeof card.quantity === 'number' ? card.quantity : (card.quantity?.$numberInt ? Number(card.quantity.$numberInt) : 1);
    if (rarity && (rarity in counts)) {
      (counts as any)[rarity] += qty;
    }
  }
  return counts;
}
