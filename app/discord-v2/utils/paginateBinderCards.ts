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
 * @param {any} item - The inventory item document from MongoDB.
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
// // /discord-v2/utils/paginateBinderCards.ts - REFACTORED FOR DISCORD EMBEDS

// import { RARITY_MAP, FOILING_MAP, EDITION_MAP } from '../utils.js';

// /**
//  * Helper to format a single inventory item into a clean, single-line string.
//  * @param {any} item - The inventory item document from MongoDB.
//  * @returns {string} A formatted string for one card line.
//  */
// function formatInventoryItem(item: any): string {
//   const rarityEmoji = RARITY_MAP[item.rarity?.toUpperCase()] || '⚪️';
//   const name = item.display_name || item.name || "Unknown Card";
//   const quantity = item.quantity || 1;
  
//   // Use inline code blocks for price and set for better visual separation
//   const price = item.tcg_market ? `\`$${item.tcg_market.toFixed(2)}\`` : '`N/A`';
//   const set = item.set?.toUpperCase() || 'UNK';
  
//   return `${rarityEmoji} **${name}** (x${quantity}) - ${price} [\`${set}\`]`;
// }

// /**
//  * Paginate binder cards and return a rich Discord Embed.
//  * @param {any} binder - The binder object (for its name).
//  * @param {any[]} inventoryItems - The array of inventory items for this binder.
//  * @param {string} discordId - Discord user ID for button custom_ids.
//  * @param {string} slug - Binder slug for button custom_ids.
//  * @param {number} page - Current page (0-indexed).
//  * @returns {{ embeds: any[], components: any[] }}
//  */
// export function paginateBinderCards(
//   binder: any,
//   inventoryItems: any[],
//   discordId: string,
//   slug: string,
//   page: number = 0
// ) {
//   // --- 1. CALCULATE STATS ---
//   let totalCards = 0;
//   let totalValue = 0;
//   inventoryItems.forEach(item => {
//     totalCards += item.quantity || 1;
//     totalValue += (item.tcg_market || 0) * (item.quantity || 1);
//   });
//   const uniquePrintings = inventoryItems.length;

//   // --- 2. PAGINATION LOGIC ---
//   const pageSize = 10;
//   const totalPages = Math.ceil(uniquePrintings / pageSize);
//   const startIndex = page * pageSize;
//   const endIndex = startIndex + pageSize;
  
//   const paginatedItems = inventoryItems.slice(startIndex, endIndex);

//   // --- 3. BUILD THE EMBED DESCRIPTION (THE CARD LIST) ---
//   let description = "";
//   if (paginatedItems.length > 0) {
//     description = paginatedItems.map(formatInventoryItem).join('\n');
//   } else {
//     description = "No cards found in this binder.";
//   }

//   // --- 4. CONSTRUCT THE DISCORD EMBED ---
//   const embed = {
//     color: 0x4F46E5, // Indigo color to match your site
//     title: `📖 ${binder.name}`,
//     fields: [
//       {
//         name: 'Total Cards',
//         value: `**${totalCards}**`,
//         inline: true,
//       },
//       {
//         name: 'Est. Value',
//         value: `**$${totalValue.toFixed(2)}**`,
//         inline: true,
//       },
//       {
//         name: 'Unique Printings',
//         value: `**${uniquePrintings}**`,
//         inline: true,
//       }
//     ],
//     description: description,
//     footer: {
//       text: `FabBazaar Bot • Page ${page + 1} of ${totalPages}`,
//       icon_url: 'https://www.fabbazaar.app/android-chrome-192x192.png' // Your site's icon
//     },
//     timestamp: new Date().toISOString(),
//   };

//   // --- 5. BUILD PAGINATION BUTTONS ---
//   const components = [];
//   if (totalPages > 1) {
//     const hasPrev = page > 0;
//     const hasNext = page + 1 < totalPages;
    
//     components.push({
//       type: 1, // Action Row
//       components: [
//         {
//           type: 2, label: 'Previous', style: 2,
//           custom_id: `binder_page:${discordId}:${slug}:${page - 1}`,
//           disabled: !hasPrev
//         },
//         {
//           type: 2, label: 'Next', style: 1,
//           custom_id: `binder_page:${discordId}:${slug}:${page + 1}`,
//           disabled: !hasNext
//         }
//       ]
//     });
//   }

//   // The final structure ready to be sent to Discord.
//   // We return a 'content' field as a fallback for systems that can't render embeds.
//   return {
//     content: `Successfully retrieved binder: ${binder.name}`,
//     embeds: [embed],
//     components: components
//   };
// }
// // // /discord-v2/utils/paginateBinderCards.ts - REFACTORED FOR INVENTORY ITEMS

// // // Make sure your utility maps are available
// // import { RARITY_MAP, FOILING_MAP, EDITION_MAP } from '../utils.js';

// // /**
// //  * Helper to format a single inventory item into a display string.
// //  * @param {any} item - The inventory item document from MongoDB.
// //  * @returns {string} A formatted string for one card.
// //  */
// // function formatInventoryItem(item: any): string {
// //   // Read properties directly from the flat inventory item document.
// //   const quantity = item.quantity || 1;
// //   const name = item.display_name || item.name || "Unknown Card";
// //   const price = item.tcg_market ? `$${item.tcg_market.toFixed(2)}` : 'N/A';
  
// //   const set = item.set?.toUpperCase() || 'UNK';
// //   const rarityLabel = RARITY_MAP[item.rarity?.toUpperCase()] || '⚪️';
// //   const foilingLabel = FOILING_MAP[item.foiling?.toLowerCase()] || '';
  
// //   // Only show edition if it's not Normal ('n')
// //   const editionLabel = item.edition && item.edition !== 'n' 
// //     ? ` (${EDITION_MAP[item.edition.toLowerCase()] || item.edition.toUpperCase()})` 
// //     : '';

// //   // Return the final formatted string for one line item.
// //   return `${rarityLabel} **${name}** (x${quantity}) - ${price}\n   *${set}${editionLabel} ${foilingLabel}*`;
// // }

// // /**
// //  * Paginate binder cards from the inventory_items collection.
// //  * @param {any} binder - The binder object (used for its name).
// //  * @param {any[]} inventoryItems - The array of inventory items for this binder.
// //  * @param {string} discordId - Discord user ID for button custom_ids.
// //  * @param {string} slug - Binder slug for button custom_ids.
// //  * @param {number} page - Current page (0-indexed).
// //  * @returns {{ content: string, components: any[] }}
// //  */
// // export function paginateBinderCards(
// //   binder: any,
// //   inventoryItems: any[], // ⬇️ MODIFIED: We now accept the items directly.
// //   discordId: string,
// //   slug: string,
// //   page: number = 0
// // ) {
// //   // --- 1. CALCULATE ACCURATE STATS from the full list ---
// //   let totalCards = 0;
// //   let totalValue = 0;
// //   inventoryItems.forEach(item => {
// //     totalCards += item.quantity || 1;
// //     totalValue += (item.tcg_market || 0) * (item.quantity || 1);
// //   });

// //   // --- 2. PAGINATION LOGIC ---
// //   const pageSize = 10;
// //   const totalPages = Math.ceil(inventoryItems.length / pageSize);
// //   const startIndex = page * pageSize;
// //   const endIndex = startIndex + pageSize;
  
// //   const paginatedItems = inventoryItems.slice(startIndex, endIndex);

// //   // --- 3. BUILD THE RESPONSE CONTENT ---
// //   const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
// //   let content = `**${binder.name}**${pageInfo}\n`;
// //   content += `Total cards: ${totalCards} - Est. Value: $${totalValue.toFixed(2)}\n\n`;

// //   if (paginatedItems.length > 0) {
// //     // If we have cards on this page, format and add them.
// //     content += paginatedItems.map(formatInventoryItem).join('\n');
// //   } else {
// //     // If the slice is empty, the binder has no cards (or it's an empty page).
// //     content += "No cards found on this page.";
// //   }

// //   // --- 4. BUILD PAGINATION BUTTONS ---
// //   const components = [];
// //   if (totalPages > 1) {
// //     const hasPrev = page > 0;
// //     const hasNext = page + 1 < totalPages;
    
// //     components.push({
// //       type: 1, // Action Row
// //       components: [
// //         {
// //           type: 2, // Button
// //           label: 'Previous',
// //           style: 2, // Secondary
// //           custom_id: `binder_page:${discordId}:${slug}:${page - 1}`,
// //           disabled: !hasPrev
// //         },
// //         {
// //           type: 2, // Button
// //           label: `${page + 1}/${totalPages}`,
// //           style: 2,
// //           custom_id: `binder_page_indicator_${Date.now()}`,
// //           disabled: true
// //         },
// //         {
// //           type: 2, // Button
// //           label: 'Next',
// //           style: 1, // Primary
// //           custom_id: `binder_page:${discordId}:${slug}:${page + 1}`,
// //           disabled: !hasNext
// //         }
// //       ]
// //     });
// //   }

// //   return { content, components };
// // }
// // //discord-v2/utils/paginateBinderCards.ts
// // import { RARITY_MAP, FOILING_MAP, EDITION_MAP } from '../utils.js';

// // /**
// //  * Helper functions to convert codes to readable names (matching wants command pattern)
// //  */
// // function getEditionName(edition) {
// //   const editionMap = {
// //     'a': 'Alpha',
// //     'f': 'First Edition', 
// //     'u': 'Unlimited',
// //     'n': 'Normal'
// //   };
// //   return editionMap[edition] || edition || 'Unknown';
// // }

// // function getFoilingName(foiling) {
// //   const foilingMap = {
// //     'r': 'Rainbow Foil',
// //     'c': 'Cold Foil', 
// //     's': 'Standard',
// //     'g': 'Gold Foil'
// //   };
// //   return foilingMap[foiling] || foiling || 'Unknown';
// // }

// // function getRarityName(rarity) {
// //   const rarityMap = {
// //     'c': 'Common',
// //     'r': 'Rare',
// //     's': 'Super Rare', 
// //     'm': 'Majestic',
// //     'l': 'Legendary',
// //     'f': 'Fabled',
// //     't': 'Token',
// //     'v': 'Marvel',
// //     'p': 'Promo'
// //   };
// //   return rarityMap[rarity] || rarity || 'Unknown';
// // }

// // /**
// //  * Helper to format a single card for binder list (matches wants format)
// //  */
// // function formatCard(card) {
// //   // Get quantity - handle both direct and MongoDB $numberInt format
// //   const quantity = typeof card.quantity === 'object' && card.quantity.$numberInt ? 
// //     parseInt(card.quantity.$numberInt) : parseInt(card.quantity || 1);
  
// //   // Get name - prefer display_name over name
// //   const name = card.printingDetails?.display_name || card.name || "Unknown";
  
// //   // Get pricing from available sources (check printingDetails first) - PRIORITIZE TCG LOW
// //   let priceStr = '';
// //   if (card.printingDetails) {
// //     const pd = card.printingDetails;
// //     if (pd.tcg_low) {
// //       const price = typeof pd.tcg_low === 'object' && pd.tcg_low.$numberDouble ? 
// //         parseFloat(pd.tcg_low.$numberDouble) : parseFloat(pd.tcg_low);
// //       if (!isNaN(price)) priceStr = ` - $${price.toFixed(2)}`;
// //     } else if (pd.tcg_mid) {
// //       const price = typeof pd.tcg_mid === 'object' && pd.tcg_mid.$numberDouble ? 
// //         parseFloat(pd.tcg_mid.$numberDouble) : parseFloat(pd.tcg_mid);
// //       if (!isNaN(price)) priceStr = ` - $${price.toFixed(2)}`;
// //     } else if (pd.tcg_market) {
// //       const price = typeof pd.tcg_market === 'object' && pd.tcg_market.$numberDouble ? 
// //         parseFloat(pd.tcg_market.$numberDouble) : parseFloat(pd.tcg_market);
// //       if (!isNaN(price)) priceStr = ` - $${price.toFixed(2)}`;
// //     }
// //   }
// //   // Fallback to direct fields - PRIORITIZE TCG LOW
// //   else if (card.tcg_low) {
// //     const price = typeof card.tcg_low === 'object' && card.tcg_low.$numberDouble ? 
// //       parseFloat(card.tcg_low.$numberDouble) : parseFloat(card.tcg_low);
// //     if (!isNaN(price)) priceStr = ` - $${price.toFixed(2)}`;
// //   } else if (card.tcg_mid) {
// //     const price = typeof card.tcg_mid === 'object' && card.tcg_mid.$numberDouble ? 
// //       parseFloat(card.tcg_mid.$numberDouble) : parseFloat(card.tcg_mid);
// //     if (!isNaN(price)) priceStr = ` - $${price.toFixed(2)}`;
// //   } else if (card.tcg_market) {
// //     const price = typeof card.tcg_market === 'object' && card.tcg_market.$numberDouble ? 
// //       parseFloat(card.tcg_market.$numberDouble) : parseFloat(card.tcg_market);
// //     if (!isNaN(price)) priceStr = ` - $${price.toFixed(2)}`;
// //   }
  
// //   // Get set info (safe version) - check printingDetails.set_id first, then fallback  
// //   let set = "Unknown";
// //   try {
// //     const setRaw = card.printingDetails?.set_id || card.printingDetails?.set || card.set_id || card.set;
// //     if (setRaw != null && typeof setRaw !== 'function') {
// //       set = String(setRaw).toUpperCase();
// //     } else {
// //       // If no set_id, try to derive from printing_id or other fields
// //       // console.log('[DEBUG] No set found for card:', card.printingDetails?.display_name || card.name);
// //     }
// //   } catch (e) {
// //     console.log('[DEBUG] Error processing set:', e.message);
// //   }
  
// //   // Get rarity info (safe version) - check printingDetails first
// //   let rarityLabel = "Unknown";
// //   try {
// //     const rarityRaw = card.rarity || card.printingDetails?.rarity;
// //     if (rarityRaw != null && typeof rarityRaw !== 'function') {
// //       const rarity = String(rarityRaw).toLowerCase();
// //       rarityLabel = getRarityName(rarity);
// //     }
// //   } catch (e) {
// //     console.log('[DEBUG] Error processing rarity:', e.message);
// //   }
  
// //   // Get foiling info (safe version) - check printingDetails first
// //   let foilingLabel = "NF";
// //   try {
// //     const foilingRaw = card.foiling || card.printingDetails?.foiling;
// //     if (foilingRaw != null && typeof foilingRaw !== 'function') {
// //       const foiling = String(foilingRaw).toLowerCase();
// //       foilingLabel = getFoilingName(foiling);
// //     }
// //   } catch (e) {
// //     console.log('[DEBUG] Error processing foiling:', e.message);
// //   }
  
// //   // Get edition info (safe version) - check printingDetails first
// //   let editionLabel = '';
// //   try {
// //     const editionRaw = card.edition || card.printingDetails?.edition;
// //     if (editionRaw != null && typeof editionRaw !== 'function') {
// //       const edition = String(editionRaw).toLowerCase();
// //       editionLabel = edition && edition !== 'n' ? 
// //         ` (${getEditionName(edition)})` : '';
// //     }
// //   } catch (e) {
// //     console.log('[DEBUG] Error processing edition:', e.message);
// //   }
  
// //   // Return the format matching wants: "1x **Card Name** - $164.17 - HNT (Legendary, Rainbow Foil)"
// //   return `${quantity}x **${name}**${priceStr} - ${set} (${rarityLabel}, ${foilingLabel}${editionLabel})`;
// // }

// // /**
// //  * Paginate binder cards with Discord components (matches wants pattern)
// //  * @param {Object} binder - The binder object with cards array
// //  * @param {string} discordId - Discord user ID
// //  * @param {string} slug - Binder slug
// //  * @param {number} page - Current page (0-indexed)
// //  * @returns {Object} - { content, components }
// //  */
// // export function paginateBinderCards(binder, discordId, slug, page = 0) {
// //   const pageSize = 10; // Show 10 cards per page (matches wants)
// //   const cards = binder.cards || [];
// //   const totalPages = Math.ceil(cards.length / pageSize);
// //   const startIndex = page * pageSize;
// //   const endIndex = startIndex + pageSize;
  
// //   // Get cards for current page
// //   const paginatedCards = cards.slice(startIndex, endIndex);
  
// //   // Format cards using the helper function
// //   const cardsList = paginatedCards.map(formatCard).join('\n') || "No cards found.";
  
// //   // Calculate totals for the entire binder (not just current page) - PRIORITIZE TCG LOW
// //   const totalCards = cards.length;
// //   let totalValue = 0;
// //   let priceableCards = 0;
  
// //   cards.forEach(card => {
// //     const quantity = typeof card.quantity === 'object' && card.quantity.$numberInt ? 
// //       parseInt(card.quantity.$numberInt) : parseInt(card.quantity || 1);
    
// //     let price = 0;
// //     // Check printingDetails first, then fallback to direct fields - PRIORITIZE TCG LOW
// //     if (card.printingDetails) {
// //       const pd = card.printingDetails;
// //       if (pd.tcg_low) {
// //         price = typeof pd.tcg_low === 'object' && pd.tcg_low.$numberDouble ? 
// //           parseFloat(pd.tcg_low.$numberDouble) : parseFloat(pd.tcg_low);
// //       } else if (pd.tcg_mid) {
// //         price = typeof pd.tcg_mid === 'object' && pd.tcg_mid.$numberDouble ? 
// //           parseFloat(pd.tcg_mid.$numberDouble) : parseFloat(pd.tcg_mid);
// //       } else if (pd.tcg_market) {
// //         price = typeof pd.tcg_market === 'object' && pd.tcg_market.$numberDouble ? 
// //           parseFloat(pd.tcg_market.$numberDouble) : parseFloat(pd.tcg_market);
// //       }
// //     } else if (card.tcg_low) {
// //       price = typeof card.tcg_low === 'object' && card.tcg_low.$numberDouble ? 
// //         parseFloat(card.tcg_low.$numberDouble) : parseFloat(card.tcg_low);
// //     } else if (card.tcg_mid) {
// //       price = typeof card.tcg_mid === 'object' && card.tcg_mid.$numberDouble ? 
// //         parseFloat(card.tcg_mid.$numberDouble) : parseFloat(card.tcg_mid);
// //     } else if (card.tcg_market) {
// //       price = typeof card.tcg_market === 'object' && card.tcg_market.$numberDouble ? 
// //         parseFloat(card.tcg_market.$numberDouble) : parseFloat(card.tcg_market);
// //     }
    
// //     if (!isNaN(price) && price > 0) {
// //       totalValue += price * quantity;
// //       priceableCards++;
// //     }
// //   });
  
// //   const valueStr = priceableCards > 0 ? ` - Est. Value: $${totalValue.toFixed(2)}` : '';
  
// //   // Build content
// //   const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
// //   const content = `**${binder.name}**${pageInfo}\nTotal cards: ${totalCards}${valueStr}\n\n${cardsList}`;
  
// //   // Navigation controls (only show if more than 1 page) - matches wants pattern
// //   const components = [];
// //   if (totalPages > 1) {
// //     const hasPrev = page > 0;
// //     const hasNext = page + 1 < totalPages;
    
// //     components.push({
// //       type: 1, // Action Row
// //       components: [
// //         {
// //           type: 2, // Button
// //           label: 'Previous',
// //           style: 2, // Secondary
// //           custom_id: `binder_page:${discordId}:${slug}:${page - 1}`,
// //           disabled: !hasPrev
// //         },
// //         {
// //           type: 2, // Button
// //           label: 'Next',
// //           style: 1, // Primary
// //           custom_id: `binder_page:${discordId}:${slug}:${page + 1}`,
// //           disabled: !hasNext
// //         },
// //         {
// //           type: 2, // Button
// //           label: `${page + 1}/${totalPages}`,
// //           style: 2, // Secondary
// //           custom_id: `binder_page_indicator_${Date.now()}`, // Unique ID
// //           disabled: true
// //         }
// //       ]
// //     });
// //   }
  
// //   return { content, components };
// // }
// // // import { RARITY_MAP, FOILING_MAP, EDITION_MAP } from '../utils.js';

// // // /**
// // //  * Helper functions to convert codes to readable names (matching wants command pattern)
// // //  */
// // // function getEditionName(edition) {
// // //   const editionMap = {
// // //     'a': 'Alpha',
// // //     'f': 'First Edition', 
// // //     'u': 'Unlimited',
// // //     'n': 'Normal'
// // //   };
// // //   return editionMap[edition] || edition || 'Unknown';
// // // }

// // // function getFoilingName(foiling) {
// // //   const foilingMap = {
// // //     'r': 'Rainbow Foil',
// // //     'c': 'Cold Foil', 
// // //     's': 'Standard',
// // //     'g': 'Gold Foil'
// // //   };
// // //   return foilingMap[foiling] || foiling || 'Unknown';
// // // }

// // // function getRarityName(rarity) {
// // //   const rarityMap = {
// // //     'c': 'Common',
// // //     'r': 'Rare',
// // //     's': 'Super Rare', 
// // //     'm': 'Majestic',
// // //     'l': 'Legendary',
// // //     'f': 'Fabled',
// // //     't': 'Token',
// // //     'v': 'Marvel',
// // //     'p': 'Promo'
// // //   };
// // //   return rarityMap[rarity] || rarity || 'Unknown';
// // // }

// // // /**
// // //  * Helper to format a single card for binder list (matches wants format)
// // //  */
// // // function formatCard(card) {
// // //   // Get quantity - handle both direct and MongoDB $numberInt format
// // //   const quantity = typeof card.quantity === 'object' && card.quantity.$numberInt ? 
// // //     parseInt(card.quantity.$numberInt) : parseInt(card.quantity || 1);
  
// // //   // Get name - prefer display_name over name
// // //   const name = card.printingDetails?.display_name || card.name || "Unknown";
  
// // //   // Get pricing from available sources (check printingDetails first)
// // //   let priceStr = '';
// // //   if (card.printingDetails) {
// // //     const pd = card.printingDetails;
// // //     if (pd.tcg_market) {
// // //       const price = typeof pd.tcg_market === 'object' && pd.tcg_market.$numberDouble ? 
// // //         parseFloat(pd.tcg_market.$numberDouble) : parseFloat(pd.tcg_market);
// // //       if (!isNaN(price)) priceStr = ` - ${price.toFixed(2)}`;
// // //     } else if (pd.tcg_mid) {
// // //       const price = typeof pd.tcg_mid === 'object' && pd.tcg_mid.$numberDouble ? 
// // //         parseFloat(pd.tcg_mid.$numberDouble) : parseFloat(pd.tcg_mid);
// // //       if (!isNaN(price)) priceStr = ` - ${price.toFixed(2)}`;
// // //     } else if (pd.tcg_low) {
// // //       const price = typeof pd.tcg_low === 'object' && pd.tcg_low.$numberDouble ? 
// // //         parseFloat(pd.tcg_low.$numberDouble) : parseFloat(pd.tcg_low);
// // //       if (!isNaN(price)) priceStr = ` - ${price.toFixed(2)}`;
// // //     }
// // //   }
// // //   // Fallback to direct fields
// // //   else if (card.tcg_market) {
// // //     const price = typeof card.tcg_market === 'object' && card.tcg_market.$numberDouble ? 
// // //       parseFloat(card.tcg_market.$numberDouble) : parseFloat(card.tcg_market);
// // //     if (!isNaN(price)) priceStr = ` - ${price.toFixed(2)}`;
// // //   }
  
// // //   // Get set info (safe version) - check printingDetails.set_id first, then fallback  
// // //   let set = "Unknown";
// // //   try {
// // //     const setRaw = card.printingDetails?.set_id || card.printingDetails?.set || card.set_id || card.set;
// // //     if (setRaw != null && typeof setRaw !== 'function') {
// // //       set = String(setRaw).toUpperCase();
// // //     } else {
// // //       // If no set_id, try to derive from printing_id or other fields
// // //       // console.log('[DEBUG] No set found for card:', card.printingDetails?.display_name || card.name);
// // //     }
// // //   } catch (e) {
// // //     console.log('[DEBUG] Error processing set:', e.message);
// // //   }
  
// // //   // Get rarity info (safe version) - check printingDetails first
// // //   let rarityLabel = "Unknown";
// // //   try {
// // //     const rarityRaw = card.rarity || card.printingDetails?.rarity;
// // //     if (rarityRaw != null && typeof rarityRaw !== 'function') {
// // //       const rarity = String(rarityRaw).toLowerCase();
// // //       rarityLabel = getRarityName(rarity);
// // //     }
// // //   } catch (e) {
// // //     console.log('[DEBUG] Error processing rarity:', e.message);
// // //   }
  
// // //   // Get foiling info (safe version) - check printingDetails first
// // //   let foilingLabel = "NF";
// // //   try {
// // //     const foilingRaw = card.foiling || card.printingDetails?.foiling;
// // //     if (foilingRaw != null && typeof foilingRaw !== 'function') {
// // //       const foiling = String(foilingRaw).toLowerCase();
// // //       foilingLabel = getFoilingName(foiling);
// // //     }
// // //   } catch (e) {
// // //     console.log('[DEBUG] Error processing foiling:', e.message);
// // //   }
  
// // //   // Get edition info (safe version) - check printingDetails first
// // //   let editionLabel = '';
// // //   try {
// // //     const editionRaw = card.edition || card.printingDetails?.edition;
// // //     if (editionRaw != null && typeof editionRaw !== 'function') {
// // //       const edition = String(editionRaw).toLowerCase();
// // //       editionLabel = edition && edition !== 'n' ? 
// // //         ` (${getEditionName(edition)})` : '';
// // //     }
// // //   } catch (e) {
// // //     console.log('[DEBUG] Error processing edition:', e.message);
// // //   }
  
// // //   // Return the format matching wants: "1x **Card Name** - $164.17 - HNT (Legendary, Rainbow Foil)"
// // //   return `${quantity}x **${name}**${priceStr} - ${set} (${rarityLabel}, ${foilingLabel}${editionLabel})`;
// // // }

// // // /**
// // //  * Paginate binder cards with Discord components (matches wants pattern)
// // //  * @param {Object} binder - The binder object with cards array
// // //  * @param {string} discordId - Discord user ID
// // //  * @param {string} slug - Binder slug
// // //  * @param {number} page - Current page (0-indexed)
// // //  * @returns {Object} - { content, components }
// // //  */
// // // export function paginateBinderCards(binder, discordId, slug, page = 0) {
// // //   const pageSize = 10; // Show 10 cards per page (matches wants)
// // //   const cards = binder.cards || [];
// // //   const totalPages = Math.ceil(cards.length / pageSize);
// // //   const startIndex = page * pageSize;
// // //   const endIndex = startIndex + pageSize;
  
// // //   // Get cards for current page
// // //   const paginatedCards = cards.slice(startIndex, endIndex);
  
// // //   // Format cards using the helper function
// // //   const cardsList = paginatedCards.map(formatCard).join('\n') || "No cards found.";
  
// // //   // Calculate totals for the entire binder (not just current page)
// // //   const totalCards = cards.length;
// // //   let totalValue = 0;
// // //   let priceableCards = 0;
  
// // //   cards.forEach(card => {
// // //     const quantity = typeof card.quantity === 'object' && card.quantity.$numberInt ? 
// // //       parseInt(card.quantity.$numberInt) : parseInt(card.quantity || 1);
    
// // //     let price = 0;
// // //     // Check printingDetails first, then fallback to direct fields
// // //     if (card.printingDetails) {
// // //       const pd = card.printingDetails;
// // //       if (pd.tcg_market) {
// // //         price = typeof pd.tcg_market === 'object' && pd.tcg_market.$numberDouble ? 
// // //           parseFloat(pd.tcg_market.$numberDouble) : parseFloat(pd.tcg_market);
// // //       } else if (pd.tcg_mid) {
// // //         price = typeof pd.tcg_mid === 'object' && pd.tcg_mid.$numberDouble ? 
// // //           parseFloat(pd.tcg_mid.$numberDouble) : parseFloat(pd.tcg_mid);
// // //       } else if (pd.tcg_low) {
// // //         price = typeof pd.tcg_low === 'object' && pd.tcg_low.$numberDouble ? 
// // //           parseFloat(pd.tcg_low.$numberDouble) : parseFloat(pd.tcg_low);
// // //       }
// // //     } else if (card.tcg_market) {
// // //       price = typeof card.tcg_market === 'object' && card.tcg_market.$numberDouble ? 
// // //         parseFloat(card.tcg_market.$numberDouble) : parseFloat(card.tcg_market);
// // //     } else if (card.tcg_mid) {
// // //       price = typeof card.tcg_mid === 'object' && card.tcg_mid.$numberDouble ? 
// // //         parseFloat(card.tcg_mid.$numberDouble) : parseFloat(card.tcg_mid);
// // //     } else if (card.tcg_low) {
// // //       price = typeof card.tcg_low === 'object' && card.tcg_low.$numberDouble ? 
// // //         parseFloat(card.tcg_low.$numberDouble) : parseFloat(card.tcg_low);
// // //     }
    
// // //     if (!isNaN(price) && price > 0) {
// // //       totalValue += price * quantity;
// // //       priceableCards++;
// // //     }
// // //   });
  
// // //   const valueStr = priceableCards > 0 ? ` - Est. Value: $${totalValue.toFixed(2)}` : '';
  
// // //   // Build content
// // //   const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
// // //   const content = `**${binder.name}**${pageInfo}\nTotal cards: ${totalCards}${valueStr}\n\n${cardsList}`;
  
// // //   // Navigation controls (only show if more than 1 page) - matches wants pattern
// // //   const components = [];
// // //   if (totalPages > 1) {
// // //     const hasPrev = page > 0;
// // //     const hasNext = page + 1 < totalPages;
    
// // //     components.push({
// // //       type: 1, // Action Row
// // //       components: [
// // //         {
// // //           type: 2, // Button
// // //           label: 'Previous',
// // //           style: 2, // Secondary
// // //           custom_id: `binder_page:${discordId}:${slug}:${page - 1}`,
// // //           disabled: !hasPrev
// // //         },
// // //         {
// // //           type: 2, // Button
// // //           label: 'Next',
// // //           style: 1, // Primary
// // //           custom_id: `binder_page:${discordId}:${slug}:${page + 1}`,
// // //           disabled: !hasNext
// // //         },
// // //         {
// // //           type: 2, // Button
// // //           label: `${page + 1}/${totalPages}`,
// // //           style: 2, // Secondary
// // //           custom_id: `binder_page_indicator_${Date.now()}`, // Unique ID
// // //           disabled: true
// // //         }
// // //       ]
// // //     });
// // //   }
  
// // //   return { content, components };
// // // }
