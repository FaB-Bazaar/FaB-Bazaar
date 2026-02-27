// app/discord-v2/utils/paginateWantsCards.ts

/**
 * Helper functions to convert codes to readable names (matching wants command)
 */
function getEditionName(edition) {
  const editionMap = {
    'a': 'Alpha',
    'f': 'First Edition', 
    'u': 'Unlimited',
    'n': 'Normal'
  };
  return editionMap[edition] || edition || 'Unknown';
}

function getFoilingName(foiling) {
  const foilingMap = {
    'r': 'Rainbow Foil',
    'c': 'Cold Foil', 
    's': 'Standard',
    'g': 'Gold Foil'
  };
  return foilingMap[foiling] || foiling || 'Unknown';
}

function getRarityName(rarity) {
  const rarityMap = {
    'c': 'Common',
    'r': 'Rare',
    's': 'Super Rare', 
    'm': 'Majestic',
    'l': 'Legendary',
    'f': 'Fabled',
    't': 'Token',
    'v': 'Marvel',
    'p': 'Promo'
  };
  return rarityMap[rarity] || rarity || 'Unknown';
}

/**
 * Helper to format a single card for wants list
 */
function formatCard(card) {
  try {
    // Get quantity
    const quantity = typeof card.quantity === 'object' && card.quantity.$numberInt ?
      parseInt(card.quantity.$numberInt) : parseInt(card.quantity || 1);

    // Get name (prefer display_name over name)
    const name = card.printingDetails?.display_name || card.name || "Unknown";
  
  // Get pricing from available sources - PRIORITIZE TCG LOW
  let price = 0;
  let priceStr = 'N/A';
  if (card.printingDetails) {
    const pd = card.printingDetails;
    if (pd.tcg_low) {
      price = typeof pd.tcg_low === 'object' && pd.tcg_low.$numberDouble ?
        parseFloat(pd.tcg_low.$numberDouble) : parseFloat(pd.tcg_low);
      if (!isNaN(price)) priceStr = `$${price.toFixed(2)}`;
    } else if (pd.tcg_mid) {
      price = typeof pd.tcg_mid === 'object' && pd.tcg_mid.$numberDouble ?
        parseFloat(pd.tcg_mid.$numberDouble) : parseFloat(pd.tcg_mid);
      if (!isNaN(price)) priceStr = `$${price.toFixed(2)}`;
    } else if (pd.tcg_market) {
      price = typeof pd.tcg_market === 'object' && pd.tcg_market.$numberDouble ?
        parseFloat(pd.tcg_market.$numberDouble) : parseFloat(pd.tcg_market);
      if (!isNaN(price)) priceStr = `$${price.toFixed(2)}`;
    }
  }

  // Get set info (safe version) - check printingDetails.set first
  let set = "Unknown";
  try {
    const setRaw = card.printingDetails?.set || card.set || card.printingDetails?.set_id;
    if (setRaw != null && typeof setRaw !== 'function') {
      set = String(setRaw).toUpperCase();
    }
  } catch (e) {
    console.log('[DEBUG] Error processing set:', e.message);
  }
  
  // Get rarity info (safe version)
  let rarityLabel = "Unknown";
  try {
    const rarityRaw = card.rarity || card.printingDetails?.rarity;
    if (rarityRaw != null && typeof rarityRaw !== 'function') {
      const rarity = String(rarityRaw).toLowerCase(); // Convert to lowercase to match the map
      rarityLabel = getRarityName(rarity);
    }
  } catch (e) {
    console.log('[DEBUG] Error processing rarity:', e.message);
  }
  
  // Get foiling info (safe version)
  let foilingLabel = "NF";
  try {
    const foilingRaw = card.foiling || card.printingDetails?.foiling;
    if (foilingRaw != null && typeof foilingRaw !== 'function') {
      const foiling = String(foilingRaw).toLowerCase(); // Convert to lowercase to match the map
      foilingLabel = getFoilingName(foiling);
    }
  } catch (e) {
    console.log('[DEBUG] Error processing foiling:', e.message);
  }
  
  // Get edition info (safe version)
  let editionLabel = '';
  try {
    const editionRaw = card.edition || card.printingDetails?.edition;
    if (editionRaw != null && typeof editionRaw !== 'function') {
      const edition = String(editionRaw).toLowerCase(); // Convert to lowercase to match the map
      editionLabel = edition && edition !== 'n' ?
        ` (${getEditionName(edition)})` : '';
    }
  } catch (e) {
    console.log('[DEBUG] Error processing edition:', e.message);
  }

  // Get color dot for any card with a color
  let colorDot = '';
  try {
    const colorRaw = card.color || card.printingDetails?.color;
    if (colorRaw != null && typeof colorRaw !== 'function') {
      const color = String(colorRaw).toLowerCase().trim();
      if (color === 'red' || color === 'r') colorDot = ' 🔴';
      else if (color === 'yellow' || color === 'y') colorDot = ' 🟡';
      else if (color === 'blue' || color === 'b') colorDot = ' 🔵';
    }
  } catch (e) {
    // Silently handle color processing errors
  }

  // Build the formatted string (without price)
  const formattedString = `${quantity}x **${name}**${colorDot} - ${set} (${rarityLabel}, ${foilingLabel}${editionLabel})`;

  // Get printing ID and URLs
  const printingId = card.printing_id || card.printingId || card.printingDetails?.printing_id;
  const printingUrl = printingId ? `${process.env.NEXT_PUBLIC_APP_URL}/printing/${printingId}` : '';

  // Build TCGPlayer affiliate link
  let tcgLink = '';
  const tcgUrl = card.printingDetails?.tcgplayer_url || card.printingDetails?.tcgplayerUrl;
  if (tcgUrl) {
    const affiliateUrl = `https://partner.tcgplayer.com/c/6477326/1830156/21018?u=${encodeURIComponent(tcgUrl)}`;
    tcgLink = ` | [Buy on TCGPlayer ${priceStr}](${affiliateUrl})`;
  }

    // Wrap main content in printing detail link
    if (printingUrl) {
      return `[${formattedString}](${printingUrl})${tcgLink}`;
    }

    return formattedString + tcgLink;
  } catch (error) {
    console.error('[Wants] Error formatting card:', error);
    // Return a simple fallback format if formatting fails
    const simpleName = card.printingDetails?.display_name || card.name || "Unknown Card";
    return `${card.quantity || 1}x ${simpleName}`;
  }
}

/**
 * Paginate wants list cards with Discord components
 * @param {Object} wantsList - The wants list object
 * @param {string} discordId - Discord user ID
 * @param {string} username - Username for display
 * @param {number} page - Current page (0-indexed)
 * @returns {Object} - { content, components }
 */
export function paginateWantsListCards(wantsList, discordId, username, page = 0) {
  const pageSize = 5; // Show 5 cards per page (reduced from 10 to avoid Discord 2000 char limit with TCGPlayer links)
  const cards = wantsList.cards || [];
  const totalPages = Math.ceil(cards.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get cards for current page
  const paginatedCards = cards.slice(startIndex, endIndex);
  
  // Format cards
  const cardsList = paginatedCards.map(formatCard).join('\n') || "No cards found.";
  
  // Calculate totals for this page - PRIORITIZE TCG LOW
  const totalCards = cards.length;
  let totalValue = 0;
  let priceableCards = 0;
  
  cards.forEach(card => {
    const quantity = typeof card.quantity === 'object' && card.quantity.$numberInt ? 
      parseInt(card.quantity.$numberInt) : parseInt(card.quantity || 1);
    
    if (card.printingDetails) {
      const pd = card.printingDetails;
      let price = 0;
      if (pd.tcg_low) {
        price = typeof pd.tcg_low === 'object' && pd.tcg_low.$numberDouble ? 
          parseFloat(pd.tcg_low.$numberDouble) : parseFloat(pd.tcg_low);
      } else if (pd.tcg_mid) {
        price = typeof pd.tcg_mid === 'object' && pd.tcg_mid.$numberDouble ? 
          parseFloat(pd.tcg_mid.$numberDouble) : parseFloat(pd.tcg_mid);
      } else if (pd.tcg_market) {
        price = typeof pd.tcg_market === 'object' && pd.tcg_market.$numberDouble ? 
          parseFloat(pd.tcg_market.$numberDouble) : parseFloat(pd.tcg_market);
      }
      
      if (!isNaN(price) && price > 0) {
        totalValue += price * quantity;
        priceableCards++;
      }
    }
  });
  
  // Priority breakdown
  const priorityCounts = {
    high: cards.filter(card => card.priority === 'high').length,
    medium: cards.filter(card => card.priority === 'medium').length,
    low: cards.filter(card => card.priority === 'low').length
  };
  
  
  const valueStr = priceableCards > 0 ? ` - Est. Value: $${totalValue.toFixed(2)}` : '';

  // Generate full wants list URL
  const userId = wantsList.userId?.toString?.() || wantsList.userId || wantsList._id;
  const fullWantsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/wants/${userId}`;

  // Build content with clickable title
  const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
  const content = `[**${username}'s Wants List**](${fullWantsUrl})${pageInfo}\nTotal cards: ${totalCards}${valueStr}\n\n${cardsList}`;
  
  // Navigation controls (only show if more than 1 page)
  const components = [];
  if (totalPages > 1) {
    const hasPrev = page > 0;
    const hasNext = page + 1 < totalPages;
    
    components.push({
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          label: 'Previous',
          style: 2, // Secondary
          custom_id: `wants_page:${discordId}:${userId}:${page - 1}`,
          disabled: !hasPrev
        },
        {
          type: 2, // Button
          label: 'Next',
          style: 1, // Primary
          custom_id: `wants_page:${discordId}:${userId}:${page + 1}`,
          disabled: !hasNext
        },
        {
          type: 2, // Button
          label: `${page + 1}/${totalPages}`,
          style: 2, // Secondary
          custom_id: `wants_page_indicator_${Date.now()}`, // Unique ID
          disabled: true
        }
      ]
    });
  }
  
  return { content, components };
}
