/**
 * Trade Request Discord Formatter
 *
 * Formats trade request data into Discord markdown for manual pasting.
 * Includes card details, pricing, priorities, and user messages.
 */

// ====================================
// Type Definitions
// ====================================

export interface TradeRequestCard {
  name: string;
  display_name?: string;
  quantity: number;
  maxQuantity: number;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  printingDetails?: {
    set_id?: string;
    collector_number?: string;
    foiling?: string;
    edition?: string;
    rarity?: string;
    tcg_low?: number;
    tcg_market?: number;
  };
}

export interface TradeRequestFormData {
  recipientUsername: string;
  message: string;
  tradeType: 'shipped' | 'in-person';
  cards: TradeRequestCard[];
}

// ====================================
// Helper Functions
// ====================================

/**
 * Get emoji for priority level
 */
function getPriorityEmoji(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'high':
      return '🔥';
    case 'medium':
      return '⚡';
    case 'low':
      return '📝';
    default:
      return '📋';
  }
}

/**
 * Get priority label text
 */
function getPriorityLabel(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'high':
      return 'High Priority';
    case 'medium':
      return 'Medium Priority';
    case 'low':
      return 'Low Priority';
    default:
      return 'Priority';
  }
}

/**
 * Convert foiling code to abbreviation
 */
function getFoilingAbbreviation(code?: string): string {
  if (!code) return 'NF';
  const lookupCode = code.toLowerCase();
  const foilingAbbreviations: Record<string, string> = {
    s: 'NF',
    r: 'RF',
    c: 'CF',
    g: 'GF',
    n: 'NF',
  };
  return foilingAbbreviations[lookupCode] || code.toUpperCase();
}

/**
 * Convert edition code to display name
 */
function getEditionDisplay(code?: string): string {
  if (!code) return '';
  const editions: Record<string, string> = {
    a: 'Alpha',
    f: 'First Edition',
    u: 'Unlimited',
    n: 'Normal',
  };
  return editions[code.toLowerCase()] || code;
}

/**
 * Convert rarity code to display name
 */
function getRarityDisplay(code?: string): string {
  if (!code) return '';
  const rarities: Record<string, string> = {
    f: 'Fabled',
    l: 'Legendary',
    m: 'Majestic',
    s: 'Super Rare',
    r: 'Rare',
    c: 'Common',
    t: 'Token',
    p: 'Promo',
  };
  return rarities[code.toLowerCase()] || code;
}

/**
 * Format trade method as emoji + text
 */
function getTradeMethodDisplay(tradeType: string): string {
  switch (tradeType) {
    case 'shipped':
      return '🚚 Ship via Mail';
    case 'in-person':
      return '🤝 Meet in Person';
    default:
      return tradeType;
  }
}

/**
 * Format a single card line with details
 */
function formatCardLine(card: TradeRequestCard): string {
  const details = card.printingDetails;
  const lines: string[] = [];

  // Card name and quantity
  const quantityText = card.quantity > 1 ? ` x${card.quantity}` : '';
  lines.push(`• **${card.name}**${quantityText}`);

  // Card metadata (collector number, foiling, edition, rarity)
  const metadata: string[] = [];
  if (details?.collector_number) metadata.push(details.collector_number);
  if (details?.foiling) metadata.push(getFoilingAbbreviation(details.foiling));
  if (details?.edition) metadata.push(getEditionDisplay(details.edition));
  if (details?.rarity) metadata.push(getRarityDisplay(details.rarity));

  if (metadata.length > 0) {
    lines.push(`  └ ${metadata.join(' • ')}`);
  }

  // Pricing (TCG Low only)
  if (details?.tcg_low !== undefined && details.tcg_low !== null && details.tcg_low > 0) {
    const totalPrice = details.tcg_low * card.quantity;
    const priceText = card.quantity > 1
      ? `TCG Low: $${details.tcg_low.toFixed(2)} each ($${totalPrice.toFixed(2)} total)`
      : `TCG Low: $${details.tcg_low.toFixed(2)}`;
    lines.push(`  └ ${priceText}`);
  } else {
    lines.push(`  └ TCG Low: Price N/A`);
  }

  // Notes (if provided)
  if (card.notes && card.notes.trim()) {
    lines.push(`  └ *Notes: ${card.notes.trim()}*`);
  }

  return lines.join('\n');
}

/**
 * Group cards by priority
 */
function groupCardsByPriority(cards: TradeRequestCard[]): {
  high: TradeRequestCard[];
  medium: TradeRequestCard[];
  low: TradeRequestCard[];
} {
  const grouped = {
    high: [] as TradeRequestCard[],
    medium: [] as TradeRequestCard[],
    low: [] as TradeRequestCard[],
  };

  cards.forEach(card => {
    const priority = card.priority.toLowerCase() as 'high' | 'medium' | 'low';
    if (grouped[priority]) {
      grouped[priority].push(card);
    } else {
      // Fallback to medium if invalid priority
      grouped.medium.push(card);
    }
  });

  return grouped;
}

/**
 * Calculate total estimated value
 */
function calculateTotalValue(cards: TradeRequestCard[]): number {
  return cards.reduce((total, card) => {
    const price = card.printingDetails?.tcg_low || 0;
    return total + (price * card.quantity);
  }, 0);
}

// ====================================
// Main Formatter Function
// ====================================

/**
 * Format trade request data as simple Discord text
 *
 * @param data - Trade request form data
 * @returns Formatted text ready to paste in Discord
 *
 * @example
 * const formatted = formatTradeRequestForDiscord({
 *   recipientUsername: "JohnDoe",
 *   message: "I need these for my deck!",
 *   tradeType: "shipped",
 *   cards: [...]
 * });
 * // Output: "1x Golden Tipple [Red] - $14.34 - SEA (Common, CF)"
 */
export function formatTradeRequestForDiscord(data: TradeRequestFormData): string {
  const lines: string[] = [];

  // Format each card as a simple line
  data.cards.forEach(card => {
    const details = card.printingDetails;

    // Quantity
    const quantity = card.quantity > 1 ? `${card.quantity}x` : '1x';

    // Card name (already includes pitch like [Red], [Blue])
    const name = card.display_name || card.name;

    // Price
    const price = details?.tcg_low !== undefined && details.tcg_low !== null && details.tcg_low > 0
      ? `$${details.tcg_low.toFixed(2)}`
      : 'Price N/A';

    // Set ID
    const setId = details?.set_id || 'Unknown';

    // Rarity and Foiling
    const rarity = getRarityDisplay(details?.rarity);
    const foiling = getFoilingAbbreviation(details?.foiling);

    // Build line: "1x Golden Tipple [Red] - $14.34 - SEA (Common, CF)"
    lines.push(`${quantity} ${name} - ${price} - ${setId} (${rarity}, ${foiling})`);
  });

  // Add user message at the end if provided
  if (data.message && data.message.trim()) {
    lines.push('');
    lines.push(`Message: ${data.message.trim()}`);
  }

  return lines.join('\n');
}
