// app/discord-v2/commands/whohas.js
import { createErrorResponse, createSuccessResponse } from '../responses.js';

/**
 * Handle /whohas command - find who has specific cards
 * @param {Object} body - The Discord interaction body
 * @param {Array} options - The command options from Discord
 * @returns {NextResponse} Discord interaction response
 */
export async function handleWhoHasCommand(body, options) {
  const cardsInput = options?.find(opt => opt.name === 'cards')?.value;
  const forTradeOnly = options?.find(opt => opt.name === 'fortrade')?.value || false;
  const minCondition = options?.find(opt => opt.name === 'condition')?.value;
  const sortBy = options?.find(opt => opt.name === 'sortby')?.value || 'username';
  
  console.log('='.repeat(80));
  console.log('[Discord WhoHas] 🚀 STARTING NEW WHOHAS COMMAND');
  console.log('[Discord WhoHas] Input cards:', JSON.stringify(cardsInput));
  console.log('[Discord WhoHas] For trade only:', forTradeOnly);
  console.log('[Discord WhoHas] Min condition:', minCondition);
  console.log('[Discord WhoHas] Sort by:', sortBy);
  console.log('[Discord WhoHas] User ID:', body.member?.user?.id || body.user?.id);
  console.log('='.repeat(80));

  if (!cardsInput) {
    console.log('[Discord WhoHas] ❌ ERROR: No cards input provided');
    return createErrorResponse("Please provide card names or printing IDs to search for.", true);
  }

  try {
    // Split input by commas and clean up
    const cardInputs = cardsInput.split(',').map(card => card.trim()).filter(card => card.length > 0);
    
    console.log('[Discord WhoHas] 📝 RAW card inputs after split/trim/filter:');
    cardInputs.forEach((input, index) => {
      console.log(`[Discord WhoHas]   ${index}: "${input}" (length: ${input.length})`);
    });
    
    if (cardInputs.length === 0) {
      console.log('[Discord WhoHas] ❌ ERROR: No valid card inputs after processing');
      return createErrorResponse("Please provide valid card names or printing IDs.", true);
    }

    if (cardInputs.length > 10) {
      console.log('[Discord WhoHas] ❌ ERROR: Too many card inputs:', cardInputs.length);
      return createErrorResponse("Too many cards requested. Please limit to 10 cards per search.", true);
    }

    console.log('[Discord WhoHas] ✅ Processed card inputs count:', cardInputs.length);

    // Step 1: Try to resolve card names to printing IDs
    const printingIds = [];
    const unresolvedCards = [];

    console.log('\n' + '='.repeat(60));
    console.log('[Discord WhoHas] 🔍 STARTING CARD RESOLUTION PHASE');
    console.log('='.repeat(60));

    for (const [index, cardInput] of cardInputs.entries()) {
      console.log(`\n[Discord WhoHas] 🎯 Processing card ${index + 1}/${cardInputs.length}: "${cardInput}"`);
      
      // Check if it's already a printing ID (format like WTR001, ARC123, etc.)
      const printingIdRegex = /^[A-Z]{3}\d{3}[A-Z]*$/;
      const isDirectPrintingId = printingIdRegex.test(cardInput.toUpperCase());
      
      console.log(`[Discord WhoHas] 🔎 Checking if "${cardInput}" is direct printing ID...`);
      console.log(`[Discord WhoHas] 🔎 Regex test result: ${isDirectPrintingId}`);
      
      if (isDirectPrintingId) {
        const printingId = cardInput.toUpperCase();
        printingIds.push(printingId);
        console.log(`[Discord WhoHas] ✅ Direct printing ID detected: "${printingId}"`);
        continue;
      }

      // Try to search for the card by name
      console.log(`[Discord WhoHas] 🔍 Searching for card by name: "${cardInput}"`);
      
      try {
        const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/printings/search`;
        console.log(`[Discord WhoHas] 🌐 Making search API request to: ${searchUrl}`);
        
        const requestBody = {
          filters: { name: cardInput },
          options: { limit: 50, show: "summary" }
        };
        
        console.log('[Discord WhoHas] 📤 Search request body:', JSON.stringify(requestBody, null, 2));
        
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log(`[Discord WhoHas] 📥 Search response status: ${searchResponse.status} ${searchResponse.statusText}`);
        console.log(`[Discord WhoHas] 📥 Search response ok: ${searchResponse.ok}`);

        if (!searchResponse.ok) {
          console.log(`[Discord WhoHas] ❌ Search API request failed for "${cardInput}"`);
          console.log(`[Discord WhoHas] ❌ Response status: ${searchResponse.status}`);
          console.log(`[Discord WhoHas] ❌ Response statusText: ${searchResponse.statusText}`);
          unresolvedCards.push(cardInput);
          continue;
        }

        const searchData = await searchResponse.json();
        
        console.log('\n' + '-'.repeat(50));
        console.log(`[Discord WhoHas] 📊 SEARCH DATA ANALYSIS for "${cardInput}"`);
        console.log('-'.repeat(50));
        console.log('[Discord WhoHas] 📊 searchData type:', typeof searchData);
        console.log('[Discord WhoHas] 📊 searchData keys:', Object.keys(searchData || {}));
        console.log('[Discord WhoHas] 📊 searchData.success:', searchData?.success);
        console.log('[Discord WhoHas] 📊 searchData.error:', searchData?.error);
        console.log('[Discord WhoHas] 📊 searchData.data type:', typeof searchData?.data);
        console.log('[Discord WhoHas] 📊 searchData.data keys:', Object.keys(searchData?.data || {}));
        console.log('[Discord WhoHas] 📊 searchData.data.printings type:', typeof searchData?.data?.printings);
        console.log('[Discord WhoHas] 📊 searchData.data.printings is Array:', Array.isArray(searchData?.data?.printings));
        console.log('[Discord WhoHas] 📊 searchData.data.printings length:', searchData?.data?.printings?.length);
        
        // Deep dive into printings array if it exists
        if (searchData?.data?.printings) {
          console.log('\n[Discord WhoHas] 🔬 DEEP DIVE INTO PRINTINGS ARRAY:');
          
          searchData.data.printings.forEach((printing, printingIndex) => {
            console.log(`[Discord WhoHas] 🔬 Printing ${printingIndex}:`);
            console.log(`[Discord WhoHas] 🔬   Type: ${typeof printing}`);
            console.log(`[Discord WhoHas] 🔬   Is null/undefined: ${printing == null}`);
            
            if (printing != null) {
              console.log(`[Discord WhoHas] 🔬   Keys: [${Object.keys(printing).join(', ')}]`);
              console.log(`[Discord WhoHas] 🔬   printing_id: ${JSON.stringify(printing.printing_id)}`);
              console.log(`[Discord WhoHas] 🔬   name: ${JSON.stringify(printing.name)}`);
              console.log(`[Discord WhoHas] 🔬   display_name: ${JSON.stringify(printing.display_name)}`);
            } else {
              console.log(`[Discord WhoHas] 🔬   ⚠️  PRINTING IS NULL/UNDEFINED!`);
            }
            
            // Only show first 5 to avoid spam
            if (printingIndex >= 4) {
              console.log(`[Discord WhoHas] 🔬   ... (showing only first 5 printings)`);
              return;
            }
          });
        }
        console.log('-'.repeat(50));
        
        if (searchData.success && searchData.data?.printings?.length > 0) {
          console.log(`[Discord WhoHas] ✅ Search successful for "${cardInput}"`);
          console.log(`[Discord WhoHas] ✅ Found ${searchData.data.printings.length} printings`);
          
          // DEFENSIVE: Filter out any undefined printings and ensure printing_id exists
          console.log('[Discord WhoHas] 🛡️  Starting defensive filtering of printings...');
          
          const validPrintings = [];
          const invalidPrintings = [];
          
          searchData.data.printings.forEach((printing, idx) => {
            if (!printing) {
              console.log(`[Discord WhoHas] ⚠️  Printing at index ${idx} is null/undefined`);
              invalidPrintings.push({ index: idx, reason: 'null/undefined', value: printing });
            } else if (!printing.printing_id) {
              console.log(`[Discord WhoHas] ⚠️  Printing at index ${idx} missing printing_id:`, JSON.stringify(printing));
              invalidPrintings.push({ index: idx, reason: 'missing printing_id', value: printing });
            } else {
              console.log(`[Discord WhoHas] ✅ Valid printing at index ${idx}: ${printing.printing_id}`);
              validPrintings.push(printing);
            }
          });
          
          console.log(`[Discord WhoHas] 🛡️  Filtering complete: ${validPrintings.length} valid, ${invalidPrintings.length} invalid`);
          
          if (invalidPrintings.length > 0) {
            console.log('[Discord WhoHas] ⚠️  INVALID PRINTINGS DETECTED:');
            invalidPrintings.forEach(invalid => {
              console.log(`[Discord WhoHas] ⚠️    Index ${invalid.index}: ${invalid.reason} - ${JSON.stringify(invalid.value)}`);
            });
          }
          
          if (validPrintings.length > 0) {
            const cardPrintingIds = validPrintings.map(p => p.printing_id);
            printingIds.push(...cardPrintingIds);
            console.log(`[Discord WhoHas] ✅ Added ${cardPrintingIds.length} printing IDs for "${cardInput}":`, cardPrintingIds);
          } else {
            console.log(`[Discord WhoHas] ❌ No valid printing IDs found for "${cardInput}" - adding to unresolved`);
            unresolvedCards.push(cardInput);
          }
        } else {
          console.log(`[Discord WhoHas] ❌ Search failed or no results for "${cardInput}"`);
          console.log(`[Discord WhoHas] ❌   success: ${searchData?.success}`);
          console.log(`[Discord WhoHas] ❌   printings length: ${searchData?.data?.printings?.length}`);
          console.log(`[Discord WhoHas] ❌   error: ${searchData?.error}`);
          unresolvedCards.push(cardInput);
        }
      } catch (searchError) {
        console.error(`[Discord WhoHas] 💥 EXCEPTION during search for "${cardInput}":`, searchError);
        console.error(`[Discord WhoHas] 💥 Error name: ${searchError.name}`);
        console.error(`[Discord WhoHas] 💥 Error message: ${searchError.message}`);
        console.error(`[Discord WhoHas] 💥 Error stack: ${searchError.stack}`);
        unresolvedCards.push(cardInput);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Discord WhoHas] 📋 CARD RESOLUTION SUMMARY');
    console.log('='.repeat(60));
    console.log('[Discord WhoHas] 📋 Total printing IDs found:', printingIds.length);
    console.log('[Discord WhoHas] 📋 Printing IDs:', printingIds);
    console.log('[Discord WhoHas] 📋 Unresolved cards:', unresolvedCards.length);
    console.log('[Discord WhoHas] 📋 Unresolved list:', unresolvedCards);
    console.log('='.repeat(60));

    if (printingIds.length === 0) {
      const errorMsg = unresolvedCards.length > 0 
        ? `Could not find any cards matching: ${unresolvedCards.join(', ')}`
        : 'No valid cards found to search for.';
      console.log('[Discord WhoHas] ❌ FINAL ERROR: No printing IDs to search for');
      return createErrorResponse(errorMsg, true);
    }

    // Step 2: Query the whohas API
    console.log('\n' + '='.repeat(60));
    console.log('[Discord WhoHas] 🔎 STARTING WHOHAS API PHASE');
    console.log('='.repeat(60));
    
    const whohasUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/whohas`;
    const queryParams = new URLSearchParams({
      printingIds: printingIds.join(','),
      limit: '20', // Limit to 20 owners to keep Discord response manageable
      sortBy: sortBy
    });

    if (forTradeOnly) {
      queryParams.set('forTradeOnly', 'true');
    }

    if (minCondition) {
      queryParams.set('minCondition', minCondition);
    }

    const fullWhohasUrl = `${whohasUrl}?${queryParams.toString()}`;
    console.log('[Discord WhoHas] 🌐 Calling whohas API:', fullWhohasUrl);
    console.log('[Discord WhoHas] 🌐 Query params breakdown:');
    for (const [key, value] of queryParams.entries()) {
      console.log(`[Discord WhoHas] 🌐   ${key}: ${value}`);
    }

    const whohasResponse = await fetch(fullWhohasUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`[Discord WhoHas] 📥 WhoHas response status: ${whohasResponse.status} ${whohasResponse.statusText}`);
    console.log(`[Discord WhoHas] 📥 WhoHas response ok: ${whohasResponse.ok}`);

    if (!whohasResponse.ok) {
      console.log('[Discord WhoHas] ❌ WhoHas API request failed');
      console.log(`[Discord WhoHas] ❌ Status: ${whohasResponse.status}`);
      console.log(`[Discord WhoHas] ❌ StatusText: ${whohasResponse.statusText}`);
      return createErrorResponse(`WhoHas API request failed with status ${whohasResponse.status}`, true);
    }

    const whohasData = await whohasResponse.json();
    
    console.log('\n' + '-'.repeat(50));
    console.log('[Discord WhoHas] 📊 WHOHAS DATA ANALYSIS');
    console.log('-'.repeat(50));
    console.log('[Discord WhoHas] 📊 whohasData type:', typeof whohasData);
    console.log('[Discord WhoHas] 📊 whohasData keys:', Object.keys(whohasData || {}));
    console.log('[Discord WhoHas] 📊 whohasData.success:', whohasData?.success);
    console.log('[Discord WhoHas] 📊 whohasData.error:', whohasData?.error);
    console.log('[Discord WhoHas] 📊 whohasData.owners type:', typeof whohasData?.owners);
    console.log('[Discord WhoHas] 📊 whohasData.owners is Array:', Array.isArray(whohasData?.owners));
    console.log('[Discord WhoHas] 📊 whohasData.owners length:', whohasData?.owners?.length);
    console.log('[Discord WhoHas] 📊 whohasData.summary:', JSON.stringify(whohasData?.summary, null, 2));
    console.log('-'.repeat(50));

    if (!whohasData.success) {
      console.log('[Discord WhoHas] ❌ WhoHas API returned success: false');
      console.log('[Discord WhoHas] ❌ Error:', whohasData.error);
      return createErrorResponse(`Search failed: ${whohasData.error}`, true);
    }

    if (!whohasData.owners || whohasData.owners.length === 0) {
      console.log('[Discord WhoHas] ℹ️  No owners found with the requested cards');
      
      let noResultsMsg = `No one has any of the requested cards`;
      if (forTradeOnly) noResultsMsg += ` marked for trade`;
      if (minCondition) noResultsMsg += ` in ${minCondition}+ condition`;
      noResultsMsg += '.';
      
      if (unresolvedCards.length > 0) {
        noResultsMsg += `\n\n⚠️ Could not find: ${unresolvedCards.join(', ')}`;
      }
      
      console.log('[Discord WhoHas] 📤 Returning no results message:', noResultsMsg);
      return createSuccessResponse(noResultsMsg, true);
    }

    // Step 3: Format the results for Discord
    console.log('\n' + '='.repeat(60));
    console.log('[Discord WhoHas] 📝 FORMATTING DISCORD RESPONSE');
    console.log('='.repeat(60));
    
    const summary = whohasData.summary;
    const owners = whohasData.owners.slice(0, 15); // Limit to 15 owners to avoid Discord message limits
    
    console.log('[Discord WhoHas] 📝 Summary:', summary);
    console.log('[Discord WhoHas] 📝 Using first', owners.length, 'owners out of', whohasData.owners.length);

    let response = `**Who Has These Cards:**\n`;
    response += `📊 **Summary:** ${summary.total_owners_found} owners, ${summary.total_cards_found} cards, $${summary.total_value_found}\n\n`;

    for (const [ownerIndex, owner] of owners.entries()) {
      console.log(`[Discord WhoHas] 📝 Processing owner ${ownerIndex + 1}: ${owner.username}`);
      
      let ownerLine = `**${owner.username}**`;
      
      // Add cards summary
      ownerLine += ` - ${owner.total_cards_found} cards`;
      
      if (owner.unique_printings_found > 1) {
        ownerLine += ` (${owner.unique_printings_found} unique)`;
      }
      
      if (owner.total_value > 0) {
        ownerLine += ` - $${owner.total_value}`;
      }

      // Show top cards for this owner (limit to 3 to keep message short)
      const topCards = owner.matching_cards.slice(0, 3);
      console.log(`[Discord WhoHas] 📝   Using top ${topCards.length} cards out of ${owner.matching_cards.length}`);
      
      const cardDetails = topCards.map((card, cardIndex) => {
        console.log(`[Discord WhoHas] 📝     Card ${cardIndex + 1}:`, JSON.stringify(card, null, 2));
        
        let cardStr = `${card.total_quantity}x ${card.display_name}`;
        
        // Add condition breakdown if there are multiple conditions
        const conditions = Object.keys(card.conditions);
        if (conditions.length > 1) {
          const conditionStr = conditions.map(cond => `${card.conditions[cond]}${cond}`).join('/');
          cardStr += ` (${conditionStr})`;
        }
        
        // UPDATED: Prioritize TCG Low price - tcg_low → tcg_market → tcg_mid → tcg_high
        const price = card.tcg_low || card.tcg_market || card.tcg_mid || card.tcg_high;
        if (price && price > 0) {
          cardStr += ` $${price}`;
        }
        
        console.log(`[Discord WhoHas] 📝     Formatted card: ${cardStr}`);
        return cardStr;
      });

      ownerLine += `\n  • ${cardDetails.join('\n  • ')}`;
      
      if (owner.matching_cards.length > 3) {
        ownerLine += `\n  • ... and ${owner.matching_cards.length - 3} more`;
      }

      response += ownerLine + '\n\n';
    }

    if (whohasData.owners.length > 15) {
      response += `... and ${whohasData.owners.length - 15} more owners.\n\n`;
    }

    // Add any unresolved cards warning
    if (unresolvedCards.length > 0) {
      response += `⚠️ **Could not find:** ${unresolvedCards.join(', ')}\n\n`;
    }

    // Add filters info
    let filtersInfo = '';
    if (forTradeOnly) filtersInfo += '🔄 For trade only • ';
    if (minCondition) filtersInfo += `📋 ${minCondition}+ condition • `;
    filtersInfo += `📊 Sorted by ${sortBy}`;
    
    response += `*${filtersInfo}*`;

    console.log('[Discord WhoHas] 📝 Final response length:', response.length);

    // Check Discord message length limit (2000 characters)
    if (response.length > 2000) {
      console.log('[Discord WhoHas] ⚠️  Response too long, truncating...');
      // Truncate and add notice
      response = response.substring(0, 1900) + '\n\n*(Results truncated - too many matches)*';
      console.log('[Discord WhoHas] ⚠️  Truncated response length:', response.length);
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Discord WhoHas] ✅ SUCCESS - RETURNING RESPONSE');
    console.log('='.repeat(60));
    console.log('[Discord WhoHas] ✅ Final response preview (first 200 chars):');
    console.log('[Discord WhoHas] ✅', response.substring(0, 200) + '...');
    console.log('='.repeat(60));

    return createSuccessResponse(response, true);

  } catch (error) {
    console.error('\n' + '💥'.repeat(20));
    console.error('[Discord WhoHas] 💥 FATAL ERROR CAUGHT:');
    console.error('[Discord WhoHas] 💥 Error name:', error.name);
    console.error('[Discord WhoHas] 💥 Error message:', error.message);
    console.error('[Discord WhoHas] 💥 Error stack:', error.stack);
    console.error('[Discord WhoHas] 💥 Error toString:', error.toString());
    console.error('💥'.repeat(20));
    
    return createErrorResponse(`Search failed: ${error.message}`, true);
  }
}

// // app/discord-v2/commands/whohas.js
// import { createErrorResponse, createSuccessResponse } from '../responses.js';

// /**
//  * Handle /whohas command - find who has specific cards
//  * @param {Object} body - The Discord interaction body
//  * @param {Array} options - The command options from Discord
//  * @returns {NextResponse} Discord interaction response
//  */
// export async function handleWhoHasCommand(body, options) {
//   const cardsInput = options?.find(opt => opt.name === 'cards')?.value;
//   const forTradeOnly = options?.find(opt => opt.name === 'fortrade')?.value || false;
//   const minCondition = options?.find(opt => opt.name === 'condition')?.value;
//   const sortBy = options?.find(opt => opt.name === 'sortby')?.value || 'username';
  
//   console.log('[Discord WhoHas] Input cards:', cardsInput);
//   console.log('[Discord WhoHas] For trade only:', forTradeOnly);
//   console.log('[Discord WhoHas] Min condition:', minCondition);
//   console.log('[Discord WhoHas] Sort by:', sortBy);

//   if (!cardsInput) {
//     return createErrorResponse("Please provide card names or printing IDs to search for.", true);
//   }

//   try {
//     // Split input by commas and clean up
//     const cardInputs = cardsInput.split(',').map(card => card.trim()).filter(card => card.length > 0);
    
//     if (cardInputs.length === 0) {
//       return createErrorResponse("Please provide valid card names or printing IDs.", true);
//     }

//     if (cardInputs.length > 10) {
//       return createErrorResponse("Too many cards requested. Please limit to 10 cards per search.", true);
//     }

//     console.log('[Discord WhoHas] Processed card inputs:', cardInputs);

//     // Step 1: Try to resolve card names to printing IDs
//     const printingIds = [];
//     const unresolvedCards = [];

//     for (const cardInput of cardInputs) {
//       // Check if it's already a printing ID (format like WTR001, ARC123, etc.)
//       if (/^[A-Z]{3}\d{3}[A-Z]*$/.test(cardInput.toUpperCase())) {
//         printingIds.push(cardInput.toUpperCase());
//         console.log('[Discord WhoHas] Direct printing ID detected:', cardInput.toUpperCase());
//         continue;
//       }

//       // Try to search for the card by name
//       try {
//         const searchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/search`;
//         const searchResponse = await fetch(searchUrl, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({
//             filters: { name: cardInput },
//             options: { limit: 50, show: "summary" }
//           })
//         });

//         const searchData = await searchResponse.json();
        
//         if (searchData.success && searchData.data?.printings?.length > 0) {
//           // Add all printing IDs for this card
//           const cardPrintingIds = searchData.data.printings.map(p => p.printing_id);
//           printingIds.push(...cardPrintingIds);
//           console.log('[Discord WhoHas] Found printings for', cardInput, ':', cardPrintingIds.length);
//         } else {
//           unresolvedCards.push(cardInput);
//           console.log('[Discord WhoHas] Could not resolve card:', cardInput);
//         }
//       } catch (searchError) {
//         console.error('[Discord WhoHas] Error searching for card:', cardInput, searchError);
//         unresolvedCards.push(cardInput);
//       }
//     }

//     if (printingIds.length === 0) {
//       const errorMsg = unresolvedCards.length > 0 
//         ? `Could not find any cards matching: ${unresolvedCards.join(', ')}`
//         : 'No valid cards found to search for.';
//       return createErrorResponse(errorMsg, true);
//     }

//     console.log('[Discord WhoHas] Total printing IDs to search:', printingIds.length);

//     // Step 2: Query the whohas API
//     const whohasUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/whohas`;
//     const queryParams = new URLSearchParams({
//       printingIds: printingIds.join(','),
//       limit: '20', // Limit to 20 owners to keep Discord response manageable
//       sortBy: sortBy
//     });

//     if (forTradeOnly) {
//       queryParams.set('forTradeOnly', 'true');
//     }

//     if (minCondition) {
//       queryParams.set('minCondition', minCondition);
//     }

//     console.log('[Discord WhoHas] Calling whohas API:', `${whohasUrl}?${queryParams.toString()}`);

//     const whohasResponse = await fetch(`${whohasUrl}?${queryParams.toString()}`, {
//       method: 'GET',
//       headers: { 'Content-Type': 'application/json' }
//     });

//     const whohasData = await whohasResponse.json();
    
//     console.log('[Discord WhoHas] WhoHas API response:', whohasData.success);
//     console.log('[Discord WhoHas] Owners found:', whohasData.owners?.length || 0);

//     if (!whohasData.success) {
//       return createErrorResponse(`Search failed: ${whohasData.error}`, true);
//     }

//     if (!whohasData.owners || whohasData.owners.length === 0) {
//       let noResultsMsg = `No one has any of the requested cards`;
//       if (forTradeOnly) noResultsMsg += ` marked for trade`;
//       if (minCondition) noResultsMsg += ` in ${minCondition}+ condition`;
//       noResultsMsg += '.';
      
//       if (unresolvedCards.length > 0) {
//         noResultsMsg += `\n\n⚠️ Could not find: ${unresolvedCards.join(', ')}`;
//       }
      
//       return createSuccessResponse(noResultsMsg, true);
//     }

//     // Step 3: Format the results for Discord
//     const summary = whohasData.summary;
//     const owners = whohasData.owners.slice(0, 15); // Limit to 15 owners to avoid Discord message limits

//     let response = `**Who Has These Cards:**\n`;
//     response += `📊 **Summary:** ${summary.total_owners_found} owners, ${summary.total_cards_found} cards, $${summary.total_value_found}\n\n`;

//     for (const owner of owners) {
//       let ownerLine = `**${owner.username}**`;
      
//       // Add cards summary
//       ownerLine += ` - ${owner.total_cards_found} cards`;
      
//       if (owner.unique_printings_found > 1) {
//         ownerLine += ` (${owner.unique_printings_found} unique)`;
//       }
      
//       if (owner.total_value > 0) {
//         ownerLine += ` - $${owner.total_value}`;
//       }

//       // Show top cards for this owner (limit to 3 to keep message short)
//       const topCards = owner.matching_cards.slice(0, 3);
//       const cardDetails = topCards.map(card => {
//         let cardStr = `${card.total_quantity}x ${card.display_name}`;
        
//         // Add condition breakdown if there are multiple conditions
//         const conditions = Object.keys(card.conditions);
//         if (conditions.length > 1) {
//           const conditionStr = conditions.map(cond => `${card.conditions[cond]}${cond}`).join('/');
//           cardStr += ` (${conditionStr})`;
//         }
        
//         // UPDATED: Prioritize TCG Low price - tcg_low → tcg_market → tcg_mid → tcg_high
//         const price = card.tcg_low || card.tcg_market || card.tcg_mid || card.tcg_high;
//         if (price && price > 0) {
//           cardStr += ` $${price}`;
//         }
        
//         return cardStr;
//       });

//       ownerLine += `\n  • ${cardDetails.join('\n  • ')}`;
      
//       if (owner.matching_cards.length > 3) {
//         ownerLine += `\n  • ... and ${owner.matching_cards.length - 3} more`;
//       }

//       response += ownerLine + '\n\n';
//     }

//     if (whohasData.owners.length > 15) {
//       response += `... and ${whohasData.owners.length - 15} more owners.\n\n`;
//     }

//     // Add any unresolved cards warning
//     if (unresolvedCards.length > 0) {
//       response += `⚠️ **Could not find:** ${unresolvedCards.join(', ')}\n\n`;
//     }

//     // Add filters info
//     let filtersInfo = '';
//     if (forTradeOnly) filtersInfo += '🔄 For trade only • ';
//     if (minCondition) filtersInfo += `📋 ${minCondition}+ condition • `;
//     filtersInfo += `📊 Sorted by ${sortBy}`;
    
//     response += `*${filtersInfo}*`;

//     // Check Discord message length limit (2000 characters)
//     if (response.length > 2000) {
//       // Truncate and add notice
//       response = response.substring(0, 1900) + '\n\n*(Results truncated - too many matches)*';
//     }

//     return createSuccessResponse(response, true);

//   } catch (error) {
//     console.error('[Discord WhoHas] Error:', error);
//     return createErrorResponse(`Search failed: ${error.message}`, true);
//   }
// }
