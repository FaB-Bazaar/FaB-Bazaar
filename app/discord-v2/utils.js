//app/discord-v2/utils.js
import nacl from 'tweetnacl';
import { userService, binderService, wantsService } from '@/lib/services';

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
  N: ''
};

export const PRINTING_SELECTOR_RARITIES = ['V', 'P']; // Only show Marvel and Promo

/**
 * Verify Discord request signature
 * @param {string} signature - Discord signature header
 * @param {string} timestamp - Discord timestamp header
 * @param {string} rawBody - Raw request body
 * @param {string} publicKey - Discord public key
 * @returns {boolean} Whether signature is valid
 */
export function verifyDiscordSignature(signature, timestamp, rawBody, publicKey) {
  try {
    // Use TextEncoder to get Uint8Array for nacl
    const encoder = new TextEncoder();
    const messageUint8 = encoder.encode(timestamp + rawBody);
    const signatureUint8 = Uint8Array.from(Buffer.from(signature, 'hex'));
    const publicKeyUint8 = Uint8Array.from(Buffer.from(publicKey, 'hex'));

    // Verify signature
    return nacl.sign.detached.verify(
      messageUint8,
      signatureUint8,
      publicKeyUint8
    );
  } catch (error) {
    console.error('[Discord] Signature verification error:', error);
    return false;
  }
}

/**
 * Helper to get quantity from card (handles $numberInt format)
 * @param {Object} card - Card object
 * @returns {number} Quantity as number
 */
export function getQuantity(card) {
  if (typeof card.quantity === 'object' && card.quantity && '$numberInt' in card.quantity) {
    return Number(card.quantity.$numberInt);
  }
  return Number(card.quantity) || 0;
}

/**
 * Helper to sum card quantities by printingId (or cardId if printingId is missing)
 * @param {Array} cards - Array of card objects
 * @returns {Array} Array of cards with summed quantities
 */
export function sumCardsById(cards) {
  const map = new Map();
  for (const card of cards) {
    // Fallback to printingDetails.unique_id if printingId is missing
    const printingId = card.printingId || card.printingDetails?.unique_id;
    // Fallback to printingDetails.id if cardId is missing
    const cardId = card.cardId || card.printingDetails?.id;
    if (!printingId && !cardId) {
      console.warn('[Discord Trade] Card missing printingId/cardId and printingDetails fallback:', card);
      continue;
    }
    const key = printingId || cardId;
    const quantity = getQuantity(card);
    if (map.has(key)) {
      map.get(key).quantity += quantity;
    } else {
      // Clone card to avoid mutating originals, and store the resolved IDs for debug
      map.set(key, { ...card, printingId, cardId, quantity });
    }
  }
  return Array.from(map.values());
}

/**
 * Helper to sum cards by printingId/cardId, keeping all metadata
 * @param {Array} cards - Array of card objects
 * @returns {Array} Array of cards with summed quantities and metadata
 */
export function sumCardsWithMetadata(cards) {
  const map = new Map();
  for (const card of cards) {
    const key = card.printingId || card.cardId || card.printingDetails?.unique_id || card.printingDetails?.id;
    if (!key) continue;
    if (map.has(key)) {
      map.get(key).quantity += getQuantity(card);
    } else {
      // Clone to avoid mutating the original
      map.set(key, { ...card, quantity: getQuantity(card) });
    }
  }
  return Array.from(map.values());
}

/**
 * Helper function to fetch binder by discordId and discordExternalId
 * @param {string} discordId - Discord user ID
 * @param {string} discordExternalId - Binder slug
 * @returns {Object} Binder object or error
 */


//   // Return cards/printings
//   return { binder };
// }
export async function fetchBinderByDiscord(discordId, slug) {
  // Log the received parameters
  console.log("[Discord Binder Lookup] Received:", { discordId, slug });

  // Find user by discordId via service layer
  const userResult = await userService.findByDiscordId(discordId);
  if (!userResult.success || !userResult.data) {
    console.error("[Discord Binder Lookup] User not found:", discordId);
    return { error: "User not found" };
  }
  const user = userResult.data;

  // Find binder by userId and slug via service layer
  const binderResult = await binderService.findBinderByIdOrSlug(slug, user._id);

  if (!binderResult.success || !binderResult.data) {
    console.error("[Discord Binder Lookup] Binder not found for userId and slug:", { userId: user._id, slug });
    return { error: "Binder not found" };
  }

  // Return binder
  return { binder: binderResult.data };
}
/**
 * Compare two users' binders and wants lists (fetching all binders by discordId)
 * @param {string} discordId1 - First user's Discord ID
 * @param {string} discordId2 - Second user's Discord ID
 * @returns {Object} Trade match results or error
 */
export async function getTradeMatches(discordId1, discordId2) {
  // Fetch users via service layer (parallel)
  const [user1Result, user2Result] = await Promise.all([
    userService.findByDiscordId(discordId1),
    userService.findByDiscordId(discordId2)
  ]);

  console.log(`[Discord Trade] user1 lookup (${discordId1}):`, user1Result.success ? user1Result.data.username || user1Result.data.discordUsername : false);
  console.log(`[Discord Trade] user2 lookup (${discordId2}):`, user2Result.success ? user2Result.data.username || user2Result.data.discordUsername : false);

  if (!user1Result.success || !user1Result.data || !user2Result.success || !user2Result.data) {
    return { error: "One or both users not found." };
  }

  const user1 = user1Result.data;
  const user2 = user2Result.data;

  if (user1._id.toString() === user2._id.toString()) {
    return { error: "Please provide two different users." };
  }

  // Fetch all binders and wants via service layer (parallel)
  const [binders1Result, binders2Result, wants1Result, wants2Result] = await Promise.all([
    binderService.getUserBindersWithStats(user1._id),
    binderService.getUserBindersWithStats(user2._id),
    wantsService.getUserWants(user1._id, {}, { limit: 10000 }),
    wantsService.getUserWants(user2._id, {}, { limit: 10000 })
  ]);

  const binders1 = binders1Result.success ? binders1Result.data : [];
  const binders2 = binders2Result.success ? binders2Result.data : [];
  const wants1 = wants1Result.success ? wants1Result.data.items : [];
  const wants2 = wants2Result.success ? wants2Result.data.items : [];
  
  console.log(`[Discord Trade] user1 binders found:`, binders1.length);
  console.log(`[Discord Trade] user1 wants items found:`, wants1.length);
  console.log(`[Discord Trade] user2 binders found:`, binders2.length);
  console.log(`[Discord Trade] user2 wants items found:`, wants2.length);

  if (!binders1.length || !binders2.length || !wants1.length || !wants2.length) {
    return { error: "One or both users are missing binders or wants list." };
  }

  // Fetch cards for each binder via service layer
  // PostgreSQL doesn't have denormalized cards in binders, so we fetch them separately
  const fetchBinderCards = async (binder) => {
    const cardsResult = await binderService.getBinderCards(
      binder._id,
      { forTrade: true }, // Only for-trade cards
      { limit: 10000, sortBy: 'default' }
    );
    return cardsResult.success ? cardsResult.data.cards : [];
  };

  // Fetch all cards for all binders (parallel)
  const [allBinder1Cards, allBinder2Cards] = await Promise.all([
    Promise.all(binders1.map(fetchBinderCards)),
    Promise.all(binders2.map(fetchBinderCards))
  ]);

  // Flatten and aggregate cards
  const allCards1 = sumCardsById(allBinder1Cards.flat());
  const allCards2 = sumCardsById(allBinder2Cards.flat());

  // Log binder details
  console.log(`[Discord Trade] user1 total cards (for trade):`, allCards1.length);
  console.log(`[Discord Trade] user2 total cards (for trade):`, allCards2.length);

  // Debug: print out the keys being compared
  // Note: wants1/wants2 are now arrays of WantsItem documents (each item IS a card)
  console.log('[Discord Trade] user1 allCards:', allCards1.map((c) => ({ printingId: c.printingId, cardId: c.cardId, quantity: c.quantity })));
  console.log('[Discord Trade] user2 wants:', wants2.map((c) => ({ printingId: c.printingId, cardId: c.card_unique_id })));
  console.log('[Discord Trade] user2 allCards:', allCards2.map((c) => ({ printingId: c.printingId, cardId: c.cardId, quantity: c.quantity })));
  console.log('[Discord Trade] user1 wants:', wants1.map((c) => ({ printingId: c.printingId, cardId: c.card_unique_id })));

  // What user1 has that user2 wants
  // wants2 is now an array of WantsItem documents, each item is a card
  const user1HasUser2Wants = (allCards1 || []).filter((card) =>
    wants2.some((want) =>
      ((card.printingId && want.printingId && card.printingId === want.printingId) ||
      (card.cardId && want.card_unique_id && card.cardId === want.card_unique_id))
    )
  );

  // What user2 has that user1 wants
  const user2HasUser1Wants = (allCards2 || []).filter((card) =>
    wants1.some((want) =>
      ((card.printingId && want.printingId && card.printingId === want.printingId) ||
      (card.cardId && want.card_unique_id && card.cardId === want.card_unique_id))
    )
  );
  
  console.log(`[Discord Trade] Comparison made: user1HasUser2Wants=${user1HasUser2Wants.length}, user2HasUser1Wants=${user2HasUser1Wants.length}`);

  return {
    user1,
    user2,
    user1HasUser2Wants,
    user2HasUser1Wants
  };
}

/**
 * Search for cards by name using the search API
 * @param {string} cardName - Name of the card to search for
 * @returns {Object} Search results with cards array
 */
export async function searchCardsByName(cardName) {
  const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app'}/discord/search/exact?name=${encodeURIComponent(cardName)}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  return searchData;
}

/**
 * Format a card for display in Discord
 * @param {Object} card - Card object
 * @returns {string} Formatted card string
 */
export function formatCardForDisplay(card) {
  const quantity = getQuantity(card);
  const name = card.name || "Unknown";
  const set = card.set || card.printingDetails?.set_id || "Unknown Set";
  const rarity = card.rarity || card.printingDetails?.rarity || "Unknown Rarity";
  const foiling = card.foiling || card.printingDetails?.foiling || "Non-Foil";
  
  // Map rarity and foiling to user-friendly names
  const rarityLabel = RARITY_MAP[rarity] || rarity;
  const foilingLabel = FOILING_MAP[foiling] || foiling;
  
  return `${quantity}x ${name} (${set}, ${rarityLabel}, ${foilingLabel})`;
}

/**
 * Create printing options for Discord select menu
 * @param {Array} printings - Array of printing objects
 * @returns {Array} Array of {label, value} objects for Discord select menu
 */
export function createPrintingOptions(printings) {
  return printings.map((printing, idx) => {
    let rarityLabel = '';
    if (printing.rarity === 'V') rarityLabel = 'Marvel';
    if (printing.rarity === 'P') rarityLabel = 'Promo';
    
    const foilingLabel = FOILING_MAP[printing.foiling] || (printing.foiling ? printing.foiling : '');
    const editionLabel = (p.edition?.toUpperCase() !== 'N') ? (EDITION_MAP[p.edition?.toUpperCase()] || p.edition) : '';
    
    return {
      label: [
        printing.set_id || printing.set || 'Set',
        foilingLabel,
        editionLabel ? `- ${editionLabel}` : '',
        rarityLabel
      ].filter(Boolean).join(' - ').slice(0, 100),
      value: printing.unique_id || String(idx),
    };
  });
}

/**
 * Create card options for Discord select menu (when multiple cards found)
 * @param {Array} cards - Array of card objects
 * @returns {Array} Array of {label, value} objects for Discord select menu
 */
export function createCardOptions(cards) {
  const pitchColorMap = { '1': 'red', '2': 'yellow', '3': 'blue' };
  
  return cards.map((card, idx) => {
    const pitchColor = pitchColorMap[String(card.pitch)] || '';
    return {
      label: `${card.name}${pitchColor ? ' (' + pitchColor + ')' : ''}`.slice(0, 100),
      value: String(idx),
    };
  });
}

/**
 * Show all printings for a specific card_unique_id with action buttons
 * @param {string} cardUniqueId - The card's unique ID
 * @param {string} cardName - The card's display name
 * @returns {Object} Formatted printings data with components
 */
export async function showCardPrintings(cardUniqueId, cardName) {
  try {
    // 🔍 DEBUG: Log what we're searching for
    console.log('[showCardPrintings] 🎯 STARTING DEBUG');
    console.log('[showCardPrintings] 🎯 Input cardUniqueId:', JSON.stringify(cardUniqueId));
    console.log('[showCardPrintings] 🎯 Input cardName:', JSON.stringify(cardName));
    console.log('[showCardPrintings] 🎯 cardUniqueId type:', typeof cardUniqueId);
    console.log('[showCardPrintings] 🎯 cardUniqueId length:', cardUniqueId?.length);
    
    // ✅ Updated to use your new search API with POST request
    const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app'}/api/printings/search`;
    
    const requestBody = {
      filters: {
        cardUniqueId: cardUniqueId
      },
      options: {
        limit: 50,
        show: "summary"
      }
    };
    
    // 🔍 DEBUG: Log the exact request
    console.log('[showCardPrintings] 🎯 REQUEST BODY:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    // 🔍 DEBUG: Log the API response details
    console.log('[showCardPrintings] 🎯 API RESPONSE STATUS:', response.status);
    console.log('[showCardPrintings] 🎯 API SUCCESS:', data.success);
    console.log('[showCardPrintings] 🎯 TOTAL PRINTINGS FOUND:', data.data?.printings?.length);
    console.log('[showCardPrintings] 🎯 MONGO QUERY USED:', JSON.stringify(data.debug?.mongoQuery, null, 2));
    
    // 🔍 DEBUG: Log ALL card names that came back
    if (data.data?.printings?.length) {
      console.log('[showCardPrintings] 🎯 ALL CARD NAMES RETURNED:');
      data.data.printings.forEach((p, i) => {
        console.log(`[showCardPrintings] 🎯   ${i+1}. "${p.display_name || p.name}" (card_unique_id: ${p.card_unique_id}) (set: ${p.set})`);
      });
      
      // 🔍 DEBUG: Check if all cards have the same unique ID
      const uniqueIds = [...new Set(data.data.printings.map(p => p.card_unique_id))];
      console.log('[showCardPrintings] 🎯 UNIQUE card_unique_ids found:', uniqueIds.length);
      console.log('[showCardPrintings] 🎯 card_unique_ids:', uniqueIds);
      
      // 🔍 DEBUG: Check if all cards have the same name
      const uniqueNames = [...new Set(data.data.printings.map(p => p.display_name || p.name))];
      console.log('[showCardPrintings] 🎯 UNIQUE card names found:', uniqueNames.length);
      console.log('[showCardPrintings] 🎯 Card names:', uniqueNames);
    }
    
    // ✅ Updated to match your new API response structure
    if (!data.success || !data.data?.printings?.length) {
      return { error: `No printings found for ${cardName}` };
    }

    const printings = data.data.printings;
    
    console.log('[showCardPrintings] 🎯 PROCESSING', printings.length, 'printings for formatting');
    
    // Simple price formatter - just returns TCG Low price
    const formatPrice = (p) => {
      if (p.tcg_low) return `$${p.tcg_low.toFixed(2)}`;
      if (p.tcg_market) return `$${p.tcg_market.toFixed(2)}`;
      if (p.tcg_mid) return `$${p.tcg_mid.toFixed(2)}`;
      return 'N/A';
    };
    
    // Format printings for display
    const results = printings.map((p, index) => {
      // 🔍 DEBUG: Log each printing being processed
      console.log(`[showCardPrintings] 🎯 Processing printing ${index+1}:`, {
        name: p.display_name || p.name,
        set: p.set,
        rarity: p.rarity,
        foiling: p.foiling,
        edition: p.edition,
        tcg_market: p.tcg_market,
        card_unique_id: p.card_unique_id
      });

      const setId = (p.set_id || p.set || 'Unknown').toUpperCase();
      const rarityLabel = RARITY_MAP[p.rarity?.toUpperCase()] || p.rarity || 'Unknown';
      const foilingLabel = FOILING_MAP[p.foiling?.toUpperCase()] || p.foiling || 'Normal';
      const editionLabel = p.edition?.toUpperCase() in EDITION_MAP ? EDITION_MAP[p.edition.toUpperCase()] : p.edition || '';

      // Add colored dot for any card with a color
      let colorDot = '';
      if (p.color) {
        const color = String(p.color).toLowerCase().trim();
        if (color === 'red' || color === 'r') colorDot = ' 🔴';
        else if (color === 'yellow' || color === 'y') colorDot = ' 🟡';
        else if (color === 'blue' || color === 'b') colorDot = ' 🔵';
      }

      // Get price for TCGPlayer link
      const price = formatPrice(p);

      // Make each printing line a clickable link to the printing detail page
      const printingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/printing/${p.printing_id}`;

      // Build TCGPlayer affiliate link if available
      let tcgLink = '';
      if (p.tcgplayer_url || p.tcgplayerUrl) {
        const tcgUrl = p.tcgplayer_url || p.tcgplayerUrl;
        // Impact affiliate link format (same as TcgAffiliateLink component)
        const affiliateUrl = `https://partner.tcgplayer.com/c/6477326/1830156/21018?u=${encodeURIComponent(tcgUrl)}`;
        tcgLink = ` | [Buy on TCGPlayer ${price}](${affiliateUrl})`;
      }

      const formatted = `[**${setId}** ${rarityLabel}${colorDot} ${foilingLabel}${editionLabel ? ` ${editionLabel}` : ''}](${printingUrl})${tcgLink}`;
      console.log(`[showCardPrintings] 🎯 Formatted result ${index+1}:`, formatted);

      return formatted;
    }).join('\n');

    console.log('[showCardPrintings] 🎯 FINAL RESULTS:');
    console.log('[showCardPrintings] 🎯 Results length:', results.length);
    console.log('[showCardPrintings] 🎯 Results preview:', results.substring(0, 200) + '...');

    // Create action buttons for adding to binder/wants/whohas/whowants
    const binderButtonCustomId = `add_to_binder:${cardUniqueId}:${encodeURIComponent(cardName)}`;
    const wantsButtonCustomId = `add_to_wants:${cardUniqueId}:${encodeURIComponent(cardName)}`;
    const whohasButtonCustomId = `who_has:${cardUniqueId}:${encodeURIComponent(cardName)}`;
    const whowantsButtonCustomId = `who_wants:${cardUniqueId}:${encodeURIComponent(cardName)}`;

    console.log('[Discord DEBUG] ===== CREATING ACTION BUTTONS =====');
    console.log('[Discord DEBUG] cardUniqueId:', cardUniqueId);
    console.log('[Discord DEBUG] cardName:', cardName);
    console.log('[Discord DEBUG] encoded cardName:', encodeURIComponent(cardName));
    console.log('[Discord DEBUG] Add to Binder custom_id:', binderButtonCustomId);
    console.log('[Discord DEBUG] Add to Wants custom_id:', wantsButtonCustomId);
    console.log('[Discord DEBUG] Who Has custom_id:', whohasButtonCustomId);
    console.log('[Discord DEBUG] Who Wants custom_id:', whowantsButtonCustomId);
    console.log('[Discord DEBUG] ======================================');

    const actionButtons = {
      type: 1, // Action row
      components: [
        {
          type: 2, // Button
          style: 1, // Primary (blue)
          label: "Add to Binder",
          custom_id: binderButtonCustomId,
        },
        {
          type: 2, // Button
          style: 4, // Secondary (gray)
          label: "Add to Wants",
          custom_id: wantsButtonCustomId,
        },
        {
          type: 2, // Button
          style: 3, // Success (green)
          label: "Who Has",
          custom_id: whohasButtonCustomId,
        },
        {
          type: 2, // Button
          style: 2, // Secondary (gray)
          label: "Who Wants",
          custom_id: whowantsButtonCustomId,
        }
      ]
    };

    return {
      content: `**All printings of ${cardName}:**\n${results}`,
      printings,
      components: [actionButtons]
    };

  } catch (error) {
    console.error('[showCardPrintings] 🎯 ERROR:', error);
    return { error: `Failed to load printings: ${error.message}` };
  }
}