// User-friendly mapping for foiling and rarity
export const FOILING_MAP = {
  S: 'NF',   // Normal Foil
  R: 'RF',   // Rainbow Foil
  C: 'CF',   // Cold Foil
  G: 'Gold CF'
};

export const RARITY_MAP = {
  C: 'Common',
  R: 'Rare',
  S: 'Super Rare',
  M: 'Majestic',
  L: 'Legendary',
  F: 'Fabled',
  T: 'Token',
  B: 'Basic',
  V: 'Marvel',
  P: 'Promo'
};

export const EDITION_MAP = {
  A: 'Alpha',
  F: '1st',
  U: 'Unl',
  N: '' // Don't show anything for N edition
};

/**
 * Formats a card list for text export (Discord, etc.)
 */
export function formatCardsForExport(cards: any[]): string {
  if (!cards || cards.length === 0) {
    return "No cards found."
  }

  return cards
    .map((card) => {
      // Check if we have printing details
      const printing = card.printingDetails;
      
      if (printing && (printing.set_id || printing.set || printing.rarity || printing.foiling)) {
        // Has printing info - use detailed format
        const setId = (printing.set_id || printing.set || 'Unknown').toUpperCase();
        const rarityLabel = RARITY_MAP[printing.rarity?.toUpperCase()] || printing.rarity || 'Unknown';
        const foilingLabel = FOILING_MAP[printing.foiling?.toUpperCase()] || printing.foiling || 'NF';
        const editionLabel = EDITION_MAP[printing.edition?.toUpperCase()] || printing.edition || '';

        // Format: "1x Card Name (SET Rarity Foil Edition)"
        // Don't show edition if it's 'N' (normal) or empty
        const showEdition = editionLabel && printing.edition?.toUpperCase() !== 'N';
        return `${card.quantity || 1}x ${card.name} (${setId} ${rarityLabel} ${foilingLabel}${showEdition ? ` ${editionLabel}` : ''})`
      } else {
        // No printing details - simple format
        return `${card.quantity || 1}x ${card.name}`
      }
    })
    .join("\n")
}

// Legacy helper functions for backward compatibility
function getRarityName(rarityCode: string): string {
  return RARITY_MAP[rarityCode?.toUpperCase()] || "Unknown Rarity"
}

function getFoilingName(foilingCode: string): string {
  return FOILING_MAP[foilingCode?.toUpperCase()] || "Unknown Foiling"
}