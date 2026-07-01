// app/discord-v2/commands/cardActions.js
import { userService, binderService } from '@/lib/services';
import { createErrorResponse, createUpdateResponse, createSuccessResponse, createComponentResponse } from '../responses.js';
import { RARITY_MAP, FOILING_MAP, EDITION_MAP } from '../utils.js';
import { getSetMetadata } from '@/lib/fab-constants/sets';

/**
 * Helper function to get the slug value from a binder object
 * Supports backwards compatibility with discordExternalId
 * @param {Object} binder - The binder object
 * @returns {string} The slug/discordExternalId value or fallback to _id
 */
function getBinderSlug(binder) {
  return binder.slug || binder.discordExternalId || binder._id.toString();
}

/**
 * Handle adding a card to user's binder
 * @param {Object} body - Discord interaction body
 * @param {string} cardUniqueId - Card unique ID
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function handleAddToBinder(body, cardUniqueId, cardName) {
  const startTime = Date.now();
  console.log('[Discord DEBUG] 🕐 handleAddToBinder STARTED at:', new Date().toISOString());

  try {
    const userId = body.member?.user?.id || body.user?.id;
    console.log('[Discord DEBUG] 🔍 userId extracted:', userId);

    if (!userId) {
      console.log('[Discord DEBUG] ❌ No userId found');
      return createErrorResponse("Could not identify user", true);
    }

    console.log('[Discord DEBUG] 👤 Finding user with discordId:', userId);
    const userStartTime = Date.now();
    const userResult = await userService.findByDiscordId(userId);
    const userFindTime = Date.now() - userStartTime;
    console.log('[Discord DEBUG] 👤 User lookup completed in:', userFindTime, 'ms');

    if (!userResult.success || !userResult.data) {
      console.log('[Discord DEBUG] ❌ User not found in database');
      return createErrorResponse("User not found. Please register first.", true);
    }
    const user = userResult.data;
    console.log('[Discord DEBUG] ✅ User found:', user.username);

    console.log('[Discord DEBUG] 📁 Finding binders for userId:', user._id);
    const binderStartTime = Date.now();
    const bindersResult = await binderService.getUserBindersWithStats(user._id);
    const binderFindTime = Date.now() - binderStartTime;
    console.log('[Discord DEBUG] 📁 Binders lookup completed in:', binderFindTime, 'ms');

    if (!bindersResult.success) {
      console.log('[Discord DEBUG] ❌ Failed to fetch binders:', bindersResult.error);
      return createErrorResponse("Failed to fetch binders. Please try again.", true);
    }

    // Filter binders (exclude archived and transit binders)
    const binders = bindersResult.data.filter(b =>
      !b.archived && !b.slug?.startsWith('transit-')
    );
    console.log('[Discord DEBUG] 📁 Number of binders (after filtering):', binders.length);

    if (!binders.length) {
      console.log('[Discord DEBUG] ❌ No binders found');
      return createErrorResponse("No binders found. Create a binder first.", true);
    }

    console.log('[Discord DEBUG] 🔧 Building binder options...');
    // Discord select menus have a maximum of 25 options
    const binderOptions = binders
      .slice(0, 25)
      .map(binder => ({
        label: binder.name || getBinderSlug(binder),
        // ID-only: the web route /api/binders/[binderId]/cards resolves by ID,
        // never slug. Emitting the slug here 404s the downstream add call.
        value: binder._id.toString()
      }));

    console.log('[Discord DEBUG] 🔧 Binder options:', binderOptions);

    const selectMenu = {
      type: 1, // Action row
      components: [
        {
          type: 3, // String select menu
          custom_id: `select_binder_for_add:${cardUniqueId}:${encodeURIComponent(cardName)}`,
          placeholder: 'Choose a binder to add this card to',
          min_values: 1,
          max_values: 1,
          options: binderOptions,
        },
      ],
    };

    const totalTime = Date.now() - startTime;
    console.log('[Discord DEBUG] ⏱️ Total handleAddToBinder execution time:', totalTime, 'ms');
    console.log('[Discord DEBUG] 📤 Returning response...');

    const response = createUpdateResponse(
      `**${cardName}** - Select a binder to add this card to:`,
      [selectMenu]
    );

    console.log('[Discord DEBUG] ✅ Response created successfully');
    return response;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[Discord DEBUG] ❌ Error in handleAddToBinder after', totalTime, 'ms:', error);
    return createErrorResponse(`Error: ${error.message}`, true);
  }
}

/**
 * Handle adding a card to user's wants list
 * @param {Object} body - Discord interaction body
 * @param {string} cardUniqueId - Card unique ID
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function handleAddToWants(body, cardUniqueId, cardName) {
  try {
    const userId = body.member?.user?.id || body.user?.id;
    
    if (!userId) {
      return createErrorResponse("Could not identify user", true);
    }

    const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/printings/search`;
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { cardUniqueId },
        options: { limit: 50, show: "summary" }
      })
    });
    
    const searchData = await searchResponse.json();
    
    if (!searchData.success || !searchData.data?.printings?.length) {
      return createErrorResponse(`No printings found for ${cardName}`, true);
    }

    const printings = searchData.data.printings;

    if (printings.length === 1) {
      return await addPrintingToWants(userId, printings[0].printing_id, cardName);
    }

    const printingOptions = printings.map((printing) => {
      const setId = (printing.set_id || printing.set || 'Unknown').toUpperCase();
      const rarityLabel = RARITY_MAP[printing.rarity?.toUpperCase()] || printing.rarity || 'Unknown';
      const foilingLabel = FOILING_MAP[printing.foiling?.toUpperCase()] || printing.foiling || 'Normal';
      const editionLabel = EDITION_MAP[printing.edition?.toUpperCase()] || printing.edition || '';
      
      return {
        label: `${setId} ${rarityLabel} ${foilingLabel} ${editionLabel}`.trim().slice(0, 100),
        value: printing.printing_id
      };
    });

    const selectMenu = {
      type: 1, // Action row
      components: [
        {
          type: 3, // String select menu
          custom_id: `select_printing_for_wants:${encodeURIComponent(cardName)}`,
          placeholder: 'Choose which printing to add to wants',
          min_values: 1,
          max_values: 1,
          options: printingOptions,
        },
      ],
    };

    return createUpdateResponse(
      `**${cardName}** - Choose which printing to add to your wants list:`,
      [selectMenu]
    );

  } catch (error) {
    console.error('[Discord] Error in handleAddToWants:', error);
    return createErrorResponse(`Error: ${error.message}`, true);
  }
}

/**
 * Handle binder selection for adding cards
 * @param {Object} body - Discord interaction body
 * @param {string} cardUniqueId - Card unique ID
 * @param {string} cardName - Card display name
 * @param {string} selectedBinder - Selected binder slug
 * @returns {NextResponse} Discord interaction response
 */
export async function handleBinderSelection(body, cardUniqueId, cardName, selectedBinder) {
  try {
    const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/printings/search`;
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { cardUniqueId },
        options: { limit: 50, show: "summary" }
      })
    });
    
    const searchData = await searchResponse.json();
    
    if (!searchData.success || !searchData.data?.printings?.length) {
      return createErrorResponse(`No printings found for ${cardName}`, true);
    }

    const printings = searchData.data.printings;

    if (printings.length === 1) {
      const userId = body.member?.user?.id || body.user?.id;
      return await addPrintingToBinder(userId, selectedBinder, printings[0].printing_id, cardName);
    }

    const printingOptions = printings.map((printing) => {
      const setId = (printing.set_id || printing.set || 'Unknown').toUpperCase();
      const rarityLabel = RARITY_MAP[printing.rarity?.toUpperCase()] || printing.rarity || 'Unknown';
      const foilingLabel = FOILING_MAP[printing.foiling?.toUpperCase()] || printing.foiling || 'Normal';
      const editionLabel = EDITION_MAP[printing.edition?.toUpperCase()] || printing.edition || '';
      
      return {
        label: `${setId} ${rarityLabel} ${foilingLabel} ${editionLabel}`.trim().slice(0, 100),
        value: printing.printing_id
      };
    });

    const selectMenu = {
      type: 1, // Action row
      components: [
        {
          type: 3, // String select menu
          custom_id: `select_printing_for_add:${selectedBinder}:${encodeURIComponent(cardName)}`,
          placeholder: 'Choose which printing to add',
          min_values: 1,
          max_values: 1,
          options: printingOptions,
        },
      ],
    };

    return createUpdateResponse(
      `**${cardName}** - Choose which printing to add to **${selectedBinder}**:`,
      [selectMenu]
    );

  } catch (error) {
    console.error('[Discord] Error in handleBinderSelection:', error);
    return createErrorResponse(`Error: ${error.message}`, true);
  }
}


export async function addPrintingToBinder(userId, binderId, printingId, cardName) {
  try {
    // Web route is ID-only — binderId is the binder's _id, carried through from the dropdown.
    const addUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/binders/${binderId}/cards`;
    const addResponse = await fetch(addUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Discord-Bot-Token': process.env.DISCORD_BOT_TOKEN,
      },
      body: JSON.stringify({
        discordId: userId,
        // FIXED: Use the new data structure your API expects
        printings: [{
          printingId: printingId,
          quantity: 1,
          condition: "NM",
          forTrade: true
        }]
      })
    });
    
    // Check if response is ok first
    if (!addResponse.ok) {
      console.error('[Discord] API Error:', addResponse.status, addResponse.statusText);
      return createErrorResponse(`Failed to add to binder: Server error ${addResponse.status}`, true);
    }
    
    // Check if response has content before parsing
    const responseText = await addResponse.text();
    if (!responseText) {
      console.error('[Discord] Empty response from binder API');
      return createErrorResponse('Failed to add to binder: Empty response', true);
    }
    
    // Try to parse as JSON
    let addData;
    try {
      addData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Discord] JSON parse error:', parseError);
      console.error('[Discord] Response text:', responseText);
      return createErrorResponse('Failed to add to binder: Invalid response format', true);
    }
    
    if (addData.success) {
      return createUpdateResponse(
        `✅ **${cardName}** added to your binder!`,
        []
      );
    } else {
      return createErrorResponse(`Failed to add to binder: ${addData.error}`, true);
    }

  } catch (error) {
    console.error('[Discord] Error adding to binder:', error);
    return createErrorResponse(`Error: ${error.message}`, true);
  }
}


/**
 * Add a specific printing to wants list
 * @param {string} userId - Discord user ID
 * @param {string} printingId - Printing ID to add
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function addPrintingToWants(userId, printingId, cardName) {
  try {
    const addUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/wants/add`;
    const addResponse = await fetch(addUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Discord-Bot-Token': process.env.DISCORD_BOT_TOKEN,
      },
      body: JSON.stringify({
        discordId: userId,
        printings: [{
          printingId: printingId,
          quantity: 1,
          priority: 'medium'
        }]
      })
    });
    
    const addData = await addResponse.json();
    
    if (addData.success) {
      return createUpdateResponse(
        `✅ **${cardName}** added to your wants list!`,
        []
      );
    } else {
      return createErrorResponse(`Failed to add to wants: ${addData.error}`, true);
    }

  } catch (error) {
    console.error('[Discord] Error adding to wants:', error);
    return createErrorResponse(`Error: ${error.message}`, true);
  }
}

/**
 * Handle "Who Has" button click - show printing selection for the card
 * @param {Object} body - Discord interaction body
 * @param {string} cardUniqueId - Card unique ID
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function handleWhoHas(body, cardUniqueId, cardName) {
    try {
      const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/printings/search`;
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: { cardUniqueId },
          options: { limit: 50, show: "summary" }
        })
      });
      
      const searchData = await searchResponse.json();
      
      if (!searchData.success || !searchData.data?.printings?.length) {
        return createErrorResponse(`No printings found for ${cardName}`, true);
      }
  
      const printings = searchData.data.printings;
  
      if (printings.length === 1) {
        return await showWhoHasPrinting(printings[0].printing_id, cardName);
      }
  
      const printingOptions = printings.map((printing) => {
        // Use full collector number (e.g. "SEA123") instead of just set code
        const collectorNumber = printing.collector_number || (printing.set_id || printing.set || 'Unknown').toUpperCase();

        // Get rarity name
        const rarityLabel = RARITY_MAP[printing.rarity?.toUpperCase()] || printing.rarity || 'Unknown';

        // Use foiling abbreviation instead of full name
        const foilingCode = printing.foiling?.toLowerCase() || 's';
        const foilingLabel = foilingCode === 's' ? 'NF' : // Non-Foil
                            foilingCode === 'r' ? 'RF' : // Rainbow Foil
                            foilingCode === 'c' ? 'CF' : // Cold Foil
                            foilingCode === 'g' ? 'GF' : // Gold Foil
                            foilingCode.toUpperCase();

        // Only show edition for sets that have first edition, and only if it's 'f' or 'u'
        // Never show 'n' (normal) as it's implied
        const setCode = (printing.set_id || printing.set || '').toLowerCase();
        const setMetadata = getSetMetadata(setCode);
        const editionCode = printing.edition?.toLowerCase() || 'n';
        const shouldShowEdition = setMetadata?.hasFirstEdition && (editionCode === 'f' || editionCode === 'u');
        const editionLabel = shouldShowEdition ? editionCode : '';

        return {
          label: `${collectorNumber} ${rarityLabel} ${foilingLabel} ${editionLabel}`.trim().slice(0, 100),
          value: printing.printing_id
        };
      });
  
      const selectMenu = {
        type: 1, // Action row
        components: [
          {
            type: 3, // String select menu
            custom_id: `select_printing_for_whohas:${encodeURIComponent(cardName)}`,
            placeholder: 'Choose which printing to see who has it',
            min_values: 1,
            max_values: 1,
            options: printingOptions,
          },
        ],
      };
  
      return createUpdateResponse(
        `**${cardName}** - Choose which printing to see who has it:`,
        [selectMenu]
      );
  
    } catch (error) {
      console.error('[Discord] Error in handleWhoHas:', error);
      return createErrorResponse(`Error: ${error.message}`, true);
    }
  }
  
/**
 * Show who has a specific printing (for trade only)
 * Updated to work with the new binder-grouped API structure
 * @param {string} printingId - Printing ID to search for
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function showWhoHasPrinting(printingId, cardName) {
    try {
      console.log('='.repeat(60));
      console.log('[Discord showWhoHasPrinting] 🚀 STARTING');
      console.log('[Discord showWhoHasPrinting] 🎯 printingId:', printingId);
      console.log('[Discord showWhoHasPrinting] 🎯 cardName:', cardName);
      console.log('='.repeat(60));

      const whohasUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/whohas`;
      const queryParams = new URLSearchParams({
        printingIds: printingId,
        limit: '20',
        sortBy: 'username',
        forTradeOnly: 'true'
      });
      
      const fullUrl = `${whohasUrl}?${queryParams.toString()}`;
      console.log('[Discord showWhoHasPrinting] 🌐 Making request to:', fullUrl);

      const whohasResponse = await fetch(fullUrl);
      
      console.log('[Discord showWhoHasPrinting] 📥 Response status:', whohasResponse.status);
      console.log('[Discord showWhoHasPrinting] 📥 Response ok:', whohasResponse.ok);

      if (!whohasResponse.ok) {
        console.log('[Discord showWhoHasPrinting] ❌ HTTP error:', whohasResponse.status);
        return createErrorResponse(`API request failed: ${whohasResponse.status}`, true);
      }

      const whohasData = await whohasResponse.json();
      
      console.log('\n' + '-'.repeat(50));
      console.log('[Discord showWhoHasPrinting] 📊 RESPONSE DATA ANALYSIS');
      console.log('-'.repeat(50));
      console.log('[Discord showWhoHasPrinting] 📊 whohasData.success:', whohasData?.success);
      console.log('[Discord showWhoHasPrinting] 📊 whohasData.owners length:', whohasData?.owners?.length);
      console.log('[Discord showWhoHasPrinting] 📊 whohasData.summary:', JSON.stringify(whohasData?.summary));
      
      // Deep dive into first few owners and their binder structure
      if (whohasData?.owners?.length > 0) {
        console.log('\n[Discord showWhoHasPrinting] 🔬 OWNERS STRUCTURE ANALYSIS:');
        whohasData.owners.slice(0, 2).forEach((owner, index) => {
          console.log(`[Discord showWhoHasPrinting] 🔬 Owner ${index}:`);
          console.log(`[Discord showWhoHasPrinting] 🔬   username: ${owner?.username}`);
          console.log(`[Discord showWhoHasPrinting] 🔬   discord_id: ${owner?.discord_id}`);
          console.log(`[Discord showWhoHasPrinting] 🔬   binders type: ${typeof owner?.binders}`);
          console.log(`[Discord showWhoHasPrinting] 🔬   binders is Array: ${Array.isArray(owner?.binders)}`);
          console.log(`[Discord showWhoHasPrinting] 🔬   binders length: ${owner?.binders?.length}`);
          
          if (owner?.binders?.length > 0) {
            owner.binders.forEach((binder, binderIndex) => {
              console.log(`[Discord showWhoHasPrinting] 🔬     Binder ${binderIndex}:`);
              console.log(`[Discord showWhoHasPrinting] 🔬       binder_name: ${binder?.binder_name}`);
              console.log(`[Discord showWhoHasPrinting] 🔬       matching_cards length: ${binder?.matching_cards?.length}`);
              
              if (binder?.matching_cards?.length > 0) {
                console.log(`[Discord showWhoHasPrinting] 🔬       First card:`, JSON.stringify(binder.matching_cards[0]));
              }
            });
          }
          
          // Check if there's a legacy matching_cards on the owner directly
          if (owner?.matching_cards) {
            console.log(`[Discord showWhoHasPrinting] 🔬   Legacy matching_cards found: ${owner.matching_cards.length}`);
          }
        });
      }
      console.log('-'.repeat(50));
      
      if (!whohasData.success) {
        console.log('[Discord showWhoHasPrinting] ❌ API returned success: false');
        return createErrorResponse(`Search failed: ${whohasData.error}`, true);
      }

      if (!whohasData.owners || whohasData.owners.length === 0) {
        console.log('[Discord showWhoHasPrinting] ℹ️  No owners found');
        return createSuccessResponse(`No one has **${cardName}** (${printingId}) available for trade.`, true);
      }

      console.log('\n[Discord showWhoHasPrinting] 📝 FORMATTING RESPONSE');
      
      const summary = whohasData.summary;
      const owners = whohasData.owners.slice(0, 10);
      
      console.log('[Discord showWhoHasPrinting] 📝 Summary:', summary);
      console.log('[Discord showWhoHasPrinting] 📝 Processing', owners.length, 'owners');

      let response = `**Who Has ${cardName} For Trade:**\n`;
      response += `📊 ${summary.total_owners_found} owners, ${summary.total_cards_found} cards available\n\n`;

      for (const [index, owner] of owners.entries()) {
        console.log(`[Discord showWhoHasPrinting] 📝 Processing owner ${index + 1}: ${owner?.username}`);

        // Use Discord mention if discord_id is available, otherwise fallback to username
        let ownerDisplay = '';
        if (owner.discord_id) {
          // Discord mention format with username fallback: <@USER_ID> (username)
          // This shows username even if Discord renders "@unknown-user" for users not in server
          let displayUsername = owner.username;
          if (displayUsername && displayUsername.startsWith('dc_')) {
            displayUsername = displayUsername.substring(3);
          }
          ownerDisplay = `<@${owner.discord_id}> (${displayUsername})`;
        } else {
          // Fallback: show username, strip dc_ prefix if present
          let displayUsername = owner.username;
          if (displayUsername && displayUsername.startsWith('dc_')) {
            displayUsername = displayUsername.substring(3);
          }
          ownerDisplay = `**${displayUsername}**`;
        }

        let ownerLine = ownerDisplay;
        
        // NEW: Handle the binder-grouped structure
        let cardInfo = null;
        let totalQuantityAcrossAllBinders = 0;
        let allConditions = {};
        let bestPrice = null;
        
        // Check if we have the new binder structure
        if (owner.binders && Array.isArray(owner.binders) && owner.binders.length > 0) {
          console.log(`[Discord showWhoHasPrinting] 📝   Processing ${owner.binders.length} binders`);
          
          // Aggregate data from all binders for this owner
          owner.binders.forEach((binder, binderIdx) => {
            if (binder.matching_cards && binder.matching_cards.length > 0) {
              binder.matching_cards.forEach(card => {
                if (card.printing_id === printingId) {
                  console.log(`[Discord showWhoHasPrinting] 📝     Found card in binder ${binderIdx}: ${card.total_quantity}x`);
                  
                  // Set card info from first matching card (they should all be the same printing)
                  if (!cardInfo) {
                    cardInfo = card;
                  }
                  
                  // Aggregate quantities and conditions
                  totalQuantityAcrossAllBinders += card.total_quantity || 0;
                  
                  if (card.conditions) {
                    Object.keys(card.conditions).forEach(condition => {
                      allConditions[condition] = (allConditions[condition] || 0) + card.conditions[condition];
                    });
                  }
                  
                  // Track best price
                  const cardPrice = card.tcg_low || card.tcg_market;
                  if (cardPrice && (!bestPrice || cardPrice < bestPrice)) {
                    bestPrice = cardPrice;
                  }
                }
              });
            }
          });
        } 
        // Fallback: Check for legacy matching_cards directly on owner (backward compatibility)
        else if (owner.matching_cards && Array.isArray(owner.matching_cards) && owner.matching_cards.length > 0) {
          console.log(`[Discord showWhoHasPrinting] 📝   Using legacy matching_cards structure`);
          cardInfo = owner.matching_cards[0];
          totalQuantityAcrossAllBinders = cardInfo.total_quantity || 0;
          allConditions = cardInfo.conditions || {};
          bestPrice = cardInfo.tcg_low || cardInfo.tcg_market;
        }
        
        // Build the owner line with aggregated data
        if (cardInfo && totalQuantityAcrossAllBinders > 0) {
          ownerLine += ` - ${totalQuantityAcrossAllBinders}x`;
          
          // Show conditions
          const conditions = Object.keys(allConditions);
          if (conditions.length > 0) {
            const conditionDisplay = conditions.map(cond => `${allConditions[cond]}${cond}`).join('/');
            ownerLine += ` (${conditionDisplay})`;
          }
          
          // Show price
          if (bestPrice && bestPrice > 0) {
            ownerLine += ` - ~$${bestPrice.toFixed(2)} each`;
          }
          
          console.log(`[Discord showWhoHasPrinting] 📝   Final line: ${ownerLine}`);
        } else {
          console.log(`[Discord showWhoHasPrinting] ⚠️  Owner ${index + 1} has no matching cards for ${printingId}`);
          ownerLine += ' - (No cards found)';
        }
        
        response += ownerLine + '\n';
      }

      if (whohasData.owners.length > 10) {
        response += `\n... and ${whohasData.owners.length - 10} more owners.`;
      }

      response += '\n\n*💬 Click on a user mention to message them directly!*';

      console.log('[Discord showWhoHasPrinting] 📝 Final response length:', response.length);

      if (response.length > 2000) {
        console.log('[Discord showWhoHasPrinting] ⚠️  Truncating response');
        response = response.substring(0, 1900) + '\n\n*(Results truncated)*';
      }

      console.log('\n' + '='.repeat(60));
      console.log('[Discord showWhoHasPrinting] ✅ SUCCESS - RETURNING RESPONSE');
      console.log('='.repeat(60));

      return createUpdateResponse(response, []);

    } catch (error) {
      console.error('\n' + '💥'.repeat(20));
      console.error('[Discord showWhoHasPrinting] 💥 FATAL ERROR:');
      console.error('[Discord showWhoHasPrinting] 💥 Error name:', error.name);
      console.error('[Discord showWhoHasPrinting] 💥 Error message:', error.message);
      console.error('[Discord showWhoHasPrinting] 💥 Error stack:', error.stack);
      console.error('💥'.repeat(20));
      
      return createErrorResponse(`Search failed: ${error.message}`, true);
    }
}

/**
 * Handle "Who Wants" button click - show printing selection for the card
 * @param {Object} body - Discord interaction body
 * @param {string} cardUniqueId - Card unique ID
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function handleWhoWants(body, cardUniqueId, cardName) {
  try {
    const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/printings/search`;
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { cardUniqueId },
        options: { limit: 50, show: "summary" }
      })
    });

    const searchData = await searchResponse.json();

    if (!searchData.success || !searchData.data?.printings?.length) {
      return createErrorResponse(`No printings found for ${cardName}`, true);
    }

    const printings = searchData.data.printings;

    if (printings.length === 1) {
      return await showWhoWantsPrinting(printings[0].printing_id, cardName);
    }

    const printingOptions = printings.map((printing) => {
      const setId = (printing.set_id || printing.set || 'Unknown').toUpperCase();
      const rarityLabel = RARITY_MAP[printing.rarity?.toUpperCase()] || printing.rarity || 'Unknown';
      const foilingLabel = FOILING_MAP[printing.foiling?.toUpperCase()] || printing.foiling || 'Normal';
      const editionLabel = EDITION_MAP[printing.edition?.toUpperCase()] || printing.edition || '';

      return {
        label: `${setId} ${rarityLabel} ${foilingLabel} ${editionLabel}`.trim().slice(0, 100),
        value: printing.printing_id
      };
    });

    const selectMenu = {
      type: 1, // Action row
      components: [
        {
          type: 3, // String select menu
          custom_id: `select_printing_for_whowants:${encodeURIComponent(cardName)}`,
          placeholder: 'Choose which printing to see who wants it',
          min_values: 1,
          max_values: 1,
          options: printingOptions,
        },
      ],
    };

    return createUpdateResponse(
      `**${cardName}** - Choose which printing to see who wants it:`,
      [selectMenu]
    );

  } catch (error) {
    console.error('[Discord] Error in handleWhoWants:', error);
    return createErrorResponse(`Error: ${error.message}`, true);
  }
}

/**
 * Show who wants a specific printing
 * @param {string} printingId - Printing ID to search for
 * @param {string} cardName - Card display name
 * @returns {NextResponse} Discord interaction response
 */
export async function showWhoWantsPrinting(printingId, cardName) {
  try {
    console.log('='.repeat(60));
    console.log('[Discord showWhoWantsPrinting] 🚀 STARTING');
    console.log('[Discord showWhoWantsPrinting] 🎯 printingId:', printingId);
    console.log('[Discord showWhoWantsPrinting] 🎯 cardName:', cardName);
    console.log('='.repeat(60));

    const whowantsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/whowants`;
    const queryParams = new URLSearchParams({
      printingIds: printingId,
      limit: '20',
      sortBy: 'priority'
    });

    const fullUrl = `${whowantsUrl}?${queryParams.toString()}`;
    console.log('[Discord showWhoWantsPrinting] 🌐 Making request to:', fullUrl);

    const whowantsResponse = await fetch(fullUrl);

    console.log('[Discord showWhoWantsPrinting] 📥 Response status:', whowantsResponse.status);
    console.log('[Discord showWhoWantsPrinting] 📥 Response ok:', whowantsResponse.ok);

    if (!whowantsResponse.ok) {
      console.log('[Discord showWhoWantsPrinting] ❌ HTTP error:', whowantsResponse.status);
      return createErrorResponse(`API request failed: ${whowantsResponse.status}`, true);
    }

    const whowantsData = await whowantsResponse.json();

    console.log('\n' + '-'.repeat(50));
    console.log('[Discord showWhoWantsPrinting] 📊 RESPONSE DATA ANALYSIS');
    console.log('-'.repeat(50));
    console.log('[Discord showWhoWantsPrinting] 📊 whowantsData.success:', whowantsData?.success);
    console.log('[Discord showWhoWantsPrinting] 📊 whowantsData.wanters length:', whowantsData?.wanters?.length);
    console.log('[Discord showWhoWantsPrinting] 📊 whowantsData.summary:', JSON.stringify(whowantsData?.summary));
    console.log('-'.repeat(50));

    if (!whowantsData.success) {
      console.log('[Discord showWhoWantsPrinting] ❌ API returned success: false');
      return createErrorResponse(`Search failed: ${whowantsData.error}`, true);
    }

    if (!whowantsData.wanters || whowantsData.wanters.length === 0) {
      console.log('[Discord showWhoWantsPrinting] ℹ️  No wanters found');
      return createSuccessResponse(`No one has **${cardName}** (${printingId}) on their wants list.`, true);
    }

    console.log('\n[Discord showWhoWantsPrinting] 📝 FORMATTING RESPONSE');

    const summary = whowantsData.summary;
    const wanters = whowantsData.wanters.slice(0, 10);

    console.log('[Discord showWhoWantsPrinting] 📝 Summary:', summary);
    console.log('[Discord showWhoWantsPrinting] 📝 Processing', wanters.length, 'wanters');

    let response = `**Who Wants ${cardName}:**\n`;
    response += `📊 ${summary.total_wanters_found} people want this, ${summary.total_cards_wanted} copies total\n\n`;

    for (const [index, wanter] of wanters.entries()) {
      console.log(`[Discord showWhoWantsPrinting] 📝 Processing wanter ${index + 1}: ${wanter?.username}`);

      // Use Discord mention if discord_id is available, otherwise fallback to username
      let wanterLine = '';
      if (wanter.discord_id) {
        // Discord mention format with username fallback: <@USER_ID> (username)
        // This shows username even if Discord renders "@unknown-user" for users not in server
        let displayUsername = wanter.username;
        if (displayUsername && displayUsername.startsWith('dc_')) {
          displayUsername = displayUsername.substring(3);
        }
        wanterLine = `<@${wanter.discord_id}> (${displayUsername})`;
      } else {
        // Fallback: show username, strip dc_ prefix if present
        let displayUsername = wanter.username;
        if (displayUsername && displayUsername.startsWith('dc_')) {
          displayUsername = displayUsername.substring(3);
        }
        wanterLine = `**${displayUsername}**`;
      }

      // Add country if available
      if (wanter.country) {
        wanterLine += ` [${wanter.country}]`;
      }

      // Find the specific card they want
      const wantedCard = wanter.wanted_cards.find(card => card.printing_id === printingId);

      if (wantedCard) {
        wanterLine += ` - wants ${wantedCard.quantity}x`;

        // Show priority
        if (wantedCard.priority === 'high') {
          wanterLine += ` 🔥 HIGH PRIORITY`;
        } else if (wantedCard.priority === 'medium') {
          wanterLine += ` (medium)`;
        } else if (wantedCard.priority === 'low') {
          wanterLine += ` (low)`;
        }

        // Show notes if available
        if (wantedCard.notes && wantedCard.notes.trim()) {
          const truncatedNotes = wantedCard.notes.length > 50
            ? wantedCard.notes.substring(0, 47) + '...'
            : wantedCard.notes;
          wanterLine += `\n  📝 "${truncatedNotes}"`;
        }

        console.log(`[Discord showWhoWantsPrinting] 📝   Final line: ${wanterLine}`);
      } else {
        console.log(`[Discord showWhoWantsPrinting] ⚠️  Wanter ${index + 1} has no matching card for ${printingId}`);
        wanterLine += ' - (No card data)';
      }

      response += wanterLine + '\n';
    }

    if (whowantsData.wanters.length > 10) {
      response += `\n... and ${whowantsData.wanters.length - 10} more people want this.`;
    }

    response += '\n\n*💬 Click on a user mention to message them directly!*';

    console.log('[Discord showWhoWantsPrinting] 📝 Final response length:', response.length);

    if (response.length > 2000) {
      console.log('[Discord showWhoWantsPrinting] ⚠️  Truncating response');
      response = response.substring(0, 1900) + '\n\n*(Results truncated)*';
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Discord showWhoWantsPrinting] ✅ SUCCESS - RETURNING RESPONSE');
    console.log('='.repeat(60));

    return createUpdateResponse(response, []);

  } catch (error) {
    console.error('\n' + '💥'.repeat(20));
    console.error('[Discord showWhoWantsPrinting] 💥 FATAL ERROR:');
    console.error('[Discord showWhoWantsPrinting] 💥 Error name:', error.name);
    console.error('[Discord showWhoWantsPrinting] 💥 Error message:', error.message);
    console.error('[Discord showWhoWantsPrinting] 💥 Error stack:', error.stack);
    console.error('💥'.repeat(20));

    return createErrorResponse(`Search failed: ${error.message}`, true);
  }
}