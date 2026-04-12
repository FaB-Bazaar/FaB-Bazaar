// app/discord-v2/commands/search.js
import { createErrorResponse, createSuccessResponse, createComponentResponse } from '../responses.js';
import { showCardPrintings } from '../utils.js';

/**
 * Notify developer about search failures
 * @param {string} searchTerm - The search term that failed
 * @param {string} errorMessage - The error message
 * @param {string} userId - The user who experienced the error
 */
async function notifyDeveloper(searchTerm, errorMessage, userId) {
  const DEVELOPER_DISCORD_ID = '263602784455098368';
  
  try {
    // Create DM channel with developer
    const createDMResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: DEVELOPER_DISCORD_ID
      })
    });
    
    if (!createDMResponse.ok) {
      console.error('[Search] Failed to create DM channel with developer:', createDMResponse.status);
      return;
    }
    
    const dmChannel = await createDMResponse.json();
    
    // Send notification message
    const notificationMessage = {
      content: `🚨 **Search Command Failed**\n` +
               `**User:** <@${userId}> (${userId})\n` +
               `**Search Term:** "${searchTerm}"\n` +
               `**Error:** ${errorMessage}\n` +
               `**Time:** ${new Date().toISOString()}`
    };
    
    const sendMessageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationMessage)
    });
    
    if (!sendMessageResponse.ok) {
      console.error('[Search] Failed to send notification to developer:', sendMessageResponse.status);
    } else {
      console.log('[Search] Successfully notified developer about search failure');
    }
    
  } catch (error) {
    console.error('[Search] Error notifying developer:', error);
  }
}

/**
 * Handle /search command - search for cards and show unique versions
 * @param {Object} body - The Discord interaction body
 * @param {Array} options - The command options from Discord
 * @returns {NextResponse} Discord interaction response
 */
export async function handleSearchCommand(body, options) {
  const name = options?.find(opt => opt.name === 'name')?.value;
  const userId = body.member?.user?.id || body.user?.id;
  
  // 🔍 ENHANCED LOGGING - Track the name through the entire flow
  console.log('[Discord Search] RAW name from Discord options:', JSON.stringify(name));
  console.log('[Discord Search] Type of name:', typeof name);
  console.log('[Discord Search] Name length:', name?.length);
  console.log('[Discord Search] Name character codes:', name ? Array.from(name).map(c => c.charCodeAt(0)) : 'N/A');
  console.log('[Discord Search] User ID:', userId);

  if (!name) {
    console.log('[Discord Search] ERROR: No name provided');
    return createErrorResponse("Please provide a card name to search for.", true); // ephemeral
  }

  try {
    const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/printings/search`;
    console.log('[Discord Search] Making API request to:', searchUrl);

    const normalizedName = name.toLowerCase().trim();

    // Collector numbers are 3 letters + 3 digits (e.g. WTR001, MON224, DTD103).
    // The broad search mode already handles collector number matching via an OR clause,
    // but exact mode skips it — so we drop exact: true for collector number lookups.
    const isCollectorNumber = /^[a-zA-Z]{3}\d{3}$/.test(normalizedName);

    const requestBody = {
      discordId: userId, // Add Discord ID for authentication
      filters: {
        name: normalizedName,
        ...(isCollectorNumber ? {} : { exact: true }),
      },
      options: {
        limit: 50,
        show: "all"
      }
    };

    // 🔍 DETAILED REQUEST LOGGING
    console.log('[Discord Search] ===== REQUEST DETAILS =====');
    console.log('[Discord Search] Discord User ID:', userId);
    console.log('[Discord Search] Request body filters.name:', JSON.stringify(requestBody.filters.name));
    console.log('[Discord Search] Full request body:', JSON.stringify(requestBody, null, 2));
    console.log('[Discord Search] ================================');

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Discord-Bot-Token': process.env.DISCORD_BOT_TOKEN,
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('[Discord Search] API response status:', response.status);
    
    if (!response.ok) {
      const errorMessage = `API request failed with status ${response.status}`;
      console.error('[Discord Search] API Error:', errorMessage);
      
      // Notify developer about API failure
      await notifyDeveloper(name, errorMessage, userId);
      
      return createErrorResponse(
        `Search temporarily unavailable. The bot developer has been notified.`, 
        true // ephemeral
      );
    }
    
    const data = await response.json();
    
    // 🔍 DETAILED RESPONSE LOGGING - Focus on the query part
    console.log('[Discord Search] ===== API RESPONSE QUERY ANALYSIS =====');
    console.log('[Discord Search] Response success:', data.success);
    console.log('[Discord Search] Debug filters received:', JSON.stringify(data.debug?.receivedFilters));
    console.log('[Discord Search] MongoDB query generated:', JSON.stringify(data.debug?.mongoQuery, null, 2));
    console.log('[Discord Search] Query execution time:', data.debug?.executionTime, 'ms');
    
    if (data.debug?.mongoQuery?.name) {
      if (typeof data.debug.mongoQuery.name === 'string') {
        console.log('[Discord Search] 🎯 EXACT MATCH for:', data.debug.mongoQuery.name);
      } else {
        console.log('[Discord Search] 🎯 Regex pattern:', data.debug.mongoQuery.name.$regex);
        console.log('[Discord Search] 🎯 Regex options:', data.debug.mongoQuery.name.$options);
      }
    }
    
    console.log('[Discord Search] Total printings found:', data.data?.printings?.length || 0);
    console.log('[Discord Search] =======================================');
    
    // Only log first few printing names to avoid spam
    if (data.data?.printings?.length > 0) {
      console.log('[Discord Search] First 3 printing names found:');
      data.data.printings.slice(0, 3).forEach((p, i) => {
        console.log(`[Discord Search]   ${i+1}. "${p.display_name || p.name}"`);
      });
    }
    
    // ✅ Updated to match your actual API response structure
    if (!data.success) {
      const errorMessage = `API returned success: false - ${data.error || 'Unknown error'}`;
      console.log('[Discord Search] API returned failure:', errorMessage);
      
      // Notify developer about API failure
      await notifyDeveloper(name, errorMessage, userId);
      
      return createErrorResponse(
        `Search failed. The bot developer has been notified.`, 
        true // ephemeral
      );
    }
    
    if (!data.data?.printings?.length) {
      console.log('[Discord Search] No results found - printings length:', data.data?.printings?.length);
      return createErrorResponse(
        `No cards found matching "${name}". Please check your spelling and try again.`, 
        true // ephemeral
      );
    }

    // Rest of your existing code for processing results...
    console.log('[Discord Search] Found', data.data.printings.length, 'total printings');

    // ✅ Updated to work with your actual API response structure
    // Group by card_unique_id to get unique cards (not just printings)
    const uniqueCards = new Map();
    for (const printing of data.data.printings) {
      const cardId = printing.card_unique_id;
      
      if (!uniqueCards.has(cardId)) {
        const cardData = {
          name: printing.display_name || printing.name,
          color: printing.color || '',
          card_unique_id: cardId,
          type_text: printing.type_text
        };
        uniqueCards.set(cardId, cardData);
      }
    }

    const cards = Array.from(uniqueCards.values());

    if (cards.length === 0) {
      console.log('[Discord Search] ERROR: No unique cards after processing');
      return createErrorResponse(
        `No cards found matching "${name}". Please check your spelling and try again.`, 
        true // ephemeral
      );
    }

    // Sort by color priority: red → yellow → blue → colorless
    const colorOrder = { 'red': 1, 'yellow': 2, 'blue': 3, '': 4 };
    cards.sort((a, b) => {
      const orderA = colorOrder[a.color] || 5;
      const orderB = colorOrder[b.color] || 5;
      return orderA - orderB;
    });

    console.log('[Discord Search] Final unique cards found:', cards.map(c => `${c.name} (${c.color})`));

    // If only one unique card found, go directly to printings
    if (cards.length === 1) {
      console.log('[Discord Search] Single card found, showing printings for:', cards[0].name);
      
      const result = await showCardPrintings(cards[0].card_unique_id, cards[0].name);
      
      if (result.error) {
        console.log('[Discord Search] ERROR from showCardPrintings:', result.error);
        
        // Notify developer about showCardPrintings failure
        await notifyDeveloper(name, `showCardPrintings error: ${result.error}`, userId);
        
        return createErrorResponse(
          `Failed to load card details. The bot developer has been notified.`, 
          true // ephemeral
        );
      }
      
      // ✅ FIXED: Check for components and use appropriate response
      // Use suppressEmbeds flag to prevent TCGPlayer link previews
      if (result.components) {
        return createComponentResponse(result.content, result.components, true, true); // ephemeral, suppressEmbeds
      } else {
        return createSuccessResponse(result.content, true, true); // ephemeral, suppressEmbeds
      }
    }

    // Multiple cards - show selection menu
    console.log('[Discord Search] Multiple cards found, creating selection menu');
    const selectOptions = cards.map((card) => {
      const colorDisplay = card.color ? ` (${card.color})` : '';
      const label = `${card.name}${colorDisplay} - ${card.type_text}`.slice(0, 100);
      return {
        label: label,
        value: card.card_unique_id
      };
    });

    const selectMenu = {
      type: 1, // Action row
      components: [
        {
          type: 3, // String select menu
          custom_id: `search_card_select:${name}`,
          placeholder: 'Select a card to see all printings',
          min_values: 1,
          max_values: 1,
          options: selectOptions,
        },
      ],
    };

    return createComponentResponse(
      `**Found ${cards.length} unique cards for "${name}":**`, 
      [selectMenu], 
      true // ephemeral
    );

  } catch (error) {
    console.error('[Discord Search] CATCH ERROR:', error);
    console.error('[Discord Search] Error stack:', error.stack);
    
    // Notify developer about unexpected error
    await notifyDeveloper(name, `Unexpected error: ${error.message}`, userId);
    
    return createErrorResponse(
      `An unexpected error occurred. The bot developer has been notified.`, 
      true // ephemeral
    );
  }
}
