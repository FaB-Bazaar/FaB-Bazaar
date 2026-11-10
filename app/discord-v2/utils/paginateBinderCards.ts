// /discord-v2/utils/paginateBinderCards.ts - REFACTORED for the requested single-line format

// Full-name maps for readable details
const RARITY_NAME_MAP = {
  'C': 'Common', 'R': 'Rare', 'S': 'Super Rare', 'M': 'Majestic',
  'L': 'Legendary', 'F': 'Fabled', 'T': 'Token', 'V': 'Marvel', 'P': 'Promo'
};
const FOILING_NAME_MAP = {
  'r': 'Rainbow Foil', 'c': 'Cold Foil', 's': 'Standard', 'g': 'Gold Foil'
};
const EDITION_NAME_MAP = {
  'a': 'Alpha', 'f': 'First Edition', 'u': 'Unlimited'
};

/**
 * Helper to format a single inventory item into the desired compact, single-line format.
 * Example: "4x **Burn Up** - $4.00 - LGS (Promo, Cold Foil)"
 * Now wrapped in a clickable link to the printing detail page.
 * @param {any} item - The inventory item.
 * @returns {string} A formatted string for one card with clickable link.
 */
function formatInventoryItem(item: any): string {
  const quantity = item.quantity || 1;
  const name = item.display_name || item.name || "Unknown Card";
  const price = item.tcg_low ? `$${item.tcg_low.toFixed(2)}` : (item.tcg_market ? `$${item.tcg_market.toFixed(2)}` : null);
  const set = item.set?.toUpperCase() || null;

  // Get color dot for any card with a color
  let colorDot = '';
  if (item.color) {
    const color = String(item.color).toLowerCase().trim();
    if (color === 'red' || color === 'r') colorDot = ' 🔴';
    else if (color === 'yellow' || color === 'y') colorDot = ' 🟡';
    else if (color === 'blue' || color === 'b') colorDot = ' 🔵';
  }

  // Start building the main part of the string
  const mainParts = [`${quantity}x **${name}**${colorDot}`];
  if (price) mainParts.push(price);
  if (set) mainParts.push(set);

  // Build the details part in parentheses (e.g., "Promo, Cold Foil, Unlimited")
  const details = [];
  const rarityName = RARITY_NAME_MAP[item.rarity?.toUpperCase()];
  if (rarityName) details.push(rarityName);

  const foilingName = FOILING_NAME_MAP[item.foiling?.toLowerCase()];
  // Hide "Standard" foiling to reduce clutter, as it's the default
  if (foilingName && item.foiling?.toLowerCase() !== 's') {
    details.push(foilingName);
  }

  const editionName = EDITION_NAME_MAP[item.edition?.toLowerCase()];
  if (editionName) {
    details.push(editionName);
  }

  // Join the main parts with " - "
  let finalString = mainParts.join(' - ');

  // Add the details to the line if any exist
  if (details.length > 0) {
    finalString += ` (${details.join(', ')})`;
  }

  // Wrap in Discord markdown link to printing detail page
  const printingId = item.printing_id || item.printingId;
  if (printingId) {
    const printingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/printing/${printingId}`;
    return `[${finalString}](${printingUrl})`;
  }

  return finalString;
}

/**
 * Paginate binder cards and return a plain text message with the new compact format.
 * @param {any} binder - The binder object (for its name).
 * @param {any[]} inventoryItems - The array of inventory items for this binder.
 * @param {string} discordId - Discord user ID for button custom_ids.
 * @param {string} slug - Binder slug for button custom_ids.
 * @param {number} page - Current page (0-indexed).
 * @returns {{ content: string, components: any[] }}
 */
export function paginateBinderCards(
  binder: any,
  inventoryItems: any[],
  discordId: string,
  slug: string,
  page: number = 0
) {
  // --- 1. CALCULATE ACCURATE STATS (using tcg_low for consistency) ---
  let totalCards = 0;
  let totalValue = 0;
  inventoryItems.forEach(item => {
    const quantity = item.quantity || 1;
    totalCards += quantity;
    // Prioritize tcg_low for value calculation to match what's displayed
    const value = item.tcg_low || item.tcg_market || 0;
    totalValue += value * quantity;
  });

  // --- 2. PAGINATION LOGIC ---
  const pageSize = 10;
  const totalPages = Math.ceil(inventoryItems.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  
  const paginatedItems = inventoryItems.slice(startIndex, endIndex);

  // --- 3. BUILD THE FINAL RESPONSE CONTENT ---
  const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
  const valueStr = totalValue > 0 ? ` - Est. Value: $${totalValue.toFixed(2)}` : '';

  // Header: Make binder name clickable with link to binder page (use binderId, not slug)
  const binderId = binder._id || binder.id;
  const binderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/binder/${binderId}`;
  let content = `[**${binder.name}**](${binderUrl})${pageInfo}\n`;
  content += `Total cards: ${totalCards}${valueStr}\n\n`;

  // Card List
  if (paginatedItems.length > 0) {
    content += paginatedItems.map(formatInventoryItem).join('\n');
  } else {
    content += "No cards found in this binder.";
  }

  // --- 4. BUILD PAGINATION BUTTONS ---
  const components = [];
  if (totalPages > 1) {
    const hasPrev = page > 0;
    const hasNext = page + 1 < totalPages;
    
    components.push({
      type: 1, // Action Row
      components: [
        { type: 2, label: 'Previous', style: 2, custom_id: `binder_page:${discordId}:${slug}:${page - 1}`, disabled: !hasPrev },
        { type: 2, label: `${page + 1}/${totalPages}`, style: 2, custom_id: `binder_page_indicator_${Date.now()}`, disabled: true },
        { type: 2, label: 'Next', style: 1, custom_id: `binder_page:${discordId}:${slug}:${page + 1}`, disabled: !hasNext }
      ]
    });
  }

  return { content, components };
}
