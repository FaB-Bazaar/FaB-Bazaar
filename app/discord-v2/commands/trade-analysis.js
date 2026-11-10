// app/discord-v2/commands/trade-analysis.js
import { userService, inventoryService, locationService } from '@/lib/services';
import { TradeAnalyzer } from "@/lib/trade-analysis/analyzer";
import { createErrorResponse, createSuccessResponse } from '../responses.js';

/**
 * Handle /trade command - simple analysis showing mutual trade opportunities
 * @param {Object} body - The Discord interaction body
 * @param {Array} options - The command options from Discord
 * @returns {NextResponse} Discord interaction response
 */
// export async function handleTradeAnalysis(body, options) {
//   try {
//     const requestingDiscordId = body.member?.user?.id || body.user?.id;
    
//     if (!requestingDiscordId) {
//       return createErrorResponse("Could not identify requesting user.", true);
//     }

//     const targetUserOption = options?.find(opt => opt.name === 'user');
//     if (!targetUserOption?.value) {
//       return createErrorResponse("Please specify a user to analyze trades with.", true);
//     }

//     const targetDiscordId = targetUserOption.value;

//     if (targetDiscordId === requestingDiscordId) {
//       return createErrorResponse("You cannot analyze trades with yourself!", true);
//     }

//     await connectToDatabase();

//     const [requestingUser, targetUser] = await Promise.all([
//       User.findOne({ discordId: requestingDiscordId }),
//       User.findOne({ discordId: targetDiscordId })
//     ]);

//     if (!requestingUser) {
//       return createErrorResponse("You don't have a registered account. Please register first!", true);
//     }

//     if (!targetUser) {
//       return createErrorResponse("Target user doesn't have a registered account.", true);
//     }

//     const analyzer = new TradeAnalyzer(
//       requestingUser._id.toString(),
//       targetUser._id.toString(),
//       true,   // includeCards: required to list cards in the response
//       'full', // format: not critical for this use case, but 'full' works
//       true    // matchOnPrintingId: Discord command uses strict matching
//     );

//     const analysisResult = await analyzer.analyze();
    
//     return formatTradeResponse(analysisResult, targetUser);

//   } catch (error) {
//     console.error("[Discord] Error in handleTradeAnalysis:", error);
//     return createErrorResponse(`Error analyzing trade: ${error.message}`);
//   }
// }

export async function handleTradeAnalysis(body, options) {
  try {
    const requestingDiscordId = body.member?.user?.id || body.user?.id;
    if (!requestingDiscordId) {
      return createErrorResponse("Could not identify requesting user.", true);
    }

    const targetUserOption = options?.find(opt => opt.name === 'user');
    const storeOption = options?.find(opt => opt.name === 'store');

    if (!targetUserOption?.value && !storeOption?.value) {
      return createErrorResponse("Please specify a user or a store name.", true);
    }

    // --- Store mode: show all trade matches at a store ---
    if (storeOption?.value && !targetUserOption?.value) {
      return handleStoreTradeMatches(requestingDiscordId, storeOption.value);
    }

    // --- User mode: 1:1 trade analysis (existing behavior) ---
    const targetDiscordId = targetUserOption.value;
    if (targetDiscordId === requestingDiscordId) {
      return createErrorResponse("You cannot analyze trades with yourself!", true);
    }

    console.log(`[Discord Command] Starting trade analysis for ${requestingDiscordId} vs ${targetDiscordId}`);

    const [requestingUserResult, targetUserResult] = await Promise.all([
      userService.findByDiscordId(requestingDiscordId),
      userService.findByDiscordId(targetDiscordId)
    ]);

    if (!requestingUserResult.success || !requestingUserResult.data) {
      return createErrorResponse("You don't have a registered account. Please register first!", true);
    }
    if (!targetUserResult.success || !targetUserResult.data) {
      return createErrorResponse("Target user doesn't have a registered account.", true);
    }

    const requestingUser = requestingUserResult.data;
    const targetUser = targetUserResult.data;

    const analyzer = new TradeAnalyzer(
      requestingUser._id.toString(),
      targetUser._id.toString(),
      true,
      'full',
      true
    );

    const analysisResult = await analyzer.analyze();
    return formatTradeResponse(analysisResult, targetUser);

  } catch (error) {
    console.error("[Discord] Error in handleTradeAnalysis:", error);
    return createErrorResponse(`Error analyzing trade: ${error.message}`);
  }
}

async function handleStoreTradeMatches(requestingDiscordId, storeName) {
  try {
    const requestingUserResult = await userService.findByDiscordId(requestingDiscordId);
    if (!requestingUserResult.success || !requestingUserResult.data) {
      return createErrorResponse("You don't have a registered account. Please register first!", true);
    }
    const userId = requestingUserResult.data._id.toString();

    // storeIdOrName is a store ID (from autocomplete) or a name fallback
    const byIdResult = await locationService.getLocationById(storeName);
    let store;
    if (byIdResult.success && byIdResult.data) {
      store = byIdResult.data;
    } else {
      const byNameResult = await locationService.browseLocations({ search: storeName, category: 'store' }, { limit: 1 });
      if (!byNameResult.success || byNameResult.data.locations.length === 0) {
        return createErrorResponse(`No store found matching "${storeName}". Try typing it in the store field to see your followed stores.`, true);
      }
      store = byNameResult.data.locations[0];
    }

    const matchResult = await inventoryService.getStoreTradeMatches(store.id, userId);
    if (!matchResult.success) {
      return createErrorResponse("Failed to load trade matches.", true);
    }

    return formatStoreTradeResponse(matchResult.data, store.name);
  } catch (error) {
    console.error("[Discord] Error in handleStoreTradeMatches:", error);
    return createErrorResponse(`Error finding store trades: ${error.message}`);
  }
}

function formatStoreTradeResponse(matches, storeName) {
  if (matches.length === 0) {
    return createSuccessResponse(`No trade opportunities found at **${storeName}**.\nMake sure you and others are following the store and have cards in your want lists / forTrade binders.`, true);
  }

  let content = `**Trade opportunities at ${storeName}** (${matches.length} player${matches.length !== 1 ? 's' : ''}):\n\n`;

  for (const match of matches.slice(0, 5)) {
    const name = match.displayUsername || match.username;
    content += `**${name}**\n`;
    if (match.theyHaveYouWant.length > 0) {
      content += `  Has for you: ${match.theyHaveYouWant.slice(0, 3).map(c => `${c.quantity}x ${c.foiling} ${c.displayName}`).join(', ')}`;
      if (match.theyHaveYouWant.length > 3) content += ` +${match.theyHaveYouWant.length - 3} more`;
      content += '\n';
    }
    if (match.theyWantYouHave.length > 0) {
      content += `  Wants from you: ${match.theyWantYouHave.slice(0, 3).map(c => `${c.quantity}x ${c.foiling} ${c.displayName}`).join(', ')}`;
      if (match.theyWantYouHave.length > 3) content += ` +${match.theyWantYouHave.length - 3} more`;
      content += '\n';
    }
    content += '\n';
  }

  if (matches.length > 5) {
    content += `... and ${matches.length - 5} more. Visit the store page on FaB Bazaar for the full list.`;
  }

  if (content.length > 2000) {
    content = content.substring(0, 1900) + '\n... (message truncated)';
  }

  return createSuccessResponse(content, true);
}

/**
 * Format the simple trade response from the TradeAnalyzer's output
 */
function formatTradeResponse(analysisResult, targetUser) {
  const youHaveTheyWant = analysisResult.cards?.you_have_for_them || [];
  const theyHaveYouWant = analysisResult.cards?.they_have_for_you || [];
  
  const targetName = targetUser.username || targetUser.discordUsername || `User ${targetUser.discordId}`;
  
  let content = `**Trade with ${targetName}:**\n\n`;
  
  if (theyHaveYouWant.length > 0) {
    content += `**They have for you:**\n`;
    theyHaveYouWant.slice(0, 10).forEach(card => {
      const foiling = card.foiling ? ` (${card.foiling})` : '';
      content += `${card.quantity}x ${card.name}${foiling}\n`;
    });
    if (theyHaveYouWant.length > 10) {
      content += `... and ${theyHaveYouWant.length - 10} more\n`;
    }
    content += '\n';
  }
  
  if (youHaveTheyWant.length > 0) {
    content += `**You have for them:**\n`;
    youHaveTheyWant.slice(0, 10).forEach(card => {
      const foiling = card.foiling ? ` (${card.foiling})` : '';
      content += `${card.quantity}x ${card.name}${foiling}\n`;
    });
    if (youHaveTheyWant.length > 10) {
      content += `... and ${youHaveTheyWant.length - 10} more\n`;
    }
  }
  
  if (theyHaveYouWant.length === 0 && youHaveTheyWant.length === 0) {
    content += `No trade matches found with ${targetName}.`;
  }

  if (content.length > 2000) {
    content = content.substring(0, 1900) + '\n... (message truncated)';
  }

  return createSuccessResponse(content, true);
}
