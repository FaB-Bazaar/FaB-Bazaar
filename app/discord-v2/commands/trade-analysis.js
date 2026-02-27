// app/discord-v2/commands/trade-analysis.js
import { userService } from '@/lib/services';
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
    if (!targetUserOption?.value) {
      return createErrorResponse("Please specify a user to analyze trades with.", true);
    }

    const targetDiscordId = targetUserOption.value;

    if (targetDiscordId === requestingDiscordId) {
      return createErrorResponse("You cannot analyze trades with yourself!", true);
    }

    // --- ADD LOGGING HERE ---
    console.log(`[Discord Command] Starting trade analysis for ${requestingDiscordId} vs ${targetDiscordId}`);

    // Fetch users via service layer (parallel)
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
      true,   // includeCards
      'full', // format
      true    // matchOnPrintingId
    );

    const analysisResult = await analyzer.analyze();
    
    // --- ADD DETAILED LOGGING OF THE RESULT ---
    console.log('[Discord Command] Analysis Result:', JSON.stringify(analysisResult, null, 2));

    return formatTradeResponse(analysisResult, targetUser);

  } catch (error) {
    console.error("[Discord] Error in handleTradeAnalysis:", error);
    return createErrorResponse(`Error analyzing trade: ${error.message}`);
  }
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
// // app/discord-v2/commands/trade-analysis.js
// import { TradeAnalyzer } from "@/lib/trade-analysis/analyzer";
// import { connectToDatabase } from "@/lib/mongodb";
// import User from "@/models/User";
// import WantsList from "@/models/WantsList";
// import Binder from "@/models/Binder";
// import mongoose from "mongoose";
// import { createErrorResponse, createSuccessResponse } from '../responses.js';

// /**
//  * Handle /trade command - simple analysis showing mutual trade opportunities
//  * @param {Object} body - The Discord interaction body
//  * @param {Array} options - The command options from Discord
//  * @returns {NextResponse} Discord interaction response
//  */
// export async function handleTradeAnalysis(body, options) {
//   try {
//     // Extract the requesting user's Discord ID
//     const requestingDiscordId = body.member?.user?.id || body.user?.id;
    
//     if (!requestingDiscordId) {
//       return createErrorResponse("Could not identify requesting user.", true);
//     }

//     // Extract target user from options
//     const targetUserOption = options?.find(opt => opt.name === 'user');
//     if (!targetUserOption?.value) {
//       return createErrorResponse("Please specify a user to analyze trades with.", true);
//     }

//     const targetDiscordId = targetUserOption.value;

//     // Prevent self-analysis
//     if (targetDiscordId === requestingDiscordId) {
//       return createErrorResponse("You cannot analyze trades with yourself!", true);
//     }

//     await connectToDatabase();

//     // Find both users
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

//     // Get trade matches
//     const tradeMatches = await findTradeMatches(requestingUser._id, targetUser._id);

//     // Format simple response
//     return formatTradeResponse(tradeMatches, targetUser);

//   } catch (error) {
//     console.error("[Discord] Error in handleTradeAnalysis:", error);
//     return createErrorResponse(`Error analyzing trade: ${error.message}`);
//   }
// }

// /**
//  * Find what each user has that the other wants
//  */
// async function findTradeMatches(currentUserId, targetUserId) {
//   // Get data we need
//   const [
//     targetWantsLists,
//     currentUserBinders,
//     targetUserBinders,
//     currentUserWantsLists
//   ] = await Promise.all([
//     WantsList.find({ userId: targetUserId }),
//     Binder.find({ userId: currentUserId, archived: { $ne: true } }),
//     Binder.find({ userId: targetUserId, archived: { $ne: true } }),
//     WantsList.find({ userId: currentUserId })
//   ]);

//   // Filter target user's binders based on visibility
//   const visibleTargetBinders = targetUserBinders.filter(binder => {
//     // Check new visibility settings
//     if (binder.visibility?.allowInMatching === false) {
//       return false;
//     }
//     // Check visibility level
//     if (binder.visibility?.level === 'private') {
//       return false;
//     }
//     // Backwards compatibility: if no visibility field, use isPublic
//     if (!binder.visibility && binder.isPublic === false) {
//       return false;
//     }
//     return true;
//   });

//   // Extract cards (use filtered binders for target)
//   const targetWants = targetWantsLists.flatMap(list => list.cards || []);
//   const currentUserHaves = currentUserBinders.flatMap(b => (b.cards || []).filter(card => card.forTrade));
//   const targetUserHaves = visibleTargetBinders.flatMap(b => (b.cards || []).filter(card => card.forTrade));
//   const currentUserWants = currentUserWantsLists.flatMap(list => list.cards || []);
//   // Find matches: what you have that they want
//   const youHaveTheyWant = findMatches(currentUserHaves, targetWants);
  
//   // Find matches: what they have that you want  
//   const theyHaveYouWant = findMatches(targetUserHaves, currentUserWants);

//   return {
//     youHaveTheyWant,
//     theyHaveYouWant
//   };
// }

// /**
//  * Find matching cards between haves and wants
//  */
// function findMatches(haveCards, wantCards) {
//   const matches = [];
  
//   for (const wantCard of wantCards) {
//     const wantPrintingId = extractPrintingId(wantCard);
//     if (!wantPrintingId) continue;

//     const matchingHaves = haveCards.filter(haveCard => {
//       const havePrintingId = extractPrintingId(haveCard);
//       return havePrintingId && havePrintingId.toLowerCase() === wantPrintingId.toLowerCase();
//     });

//     if (matchingHaves.length > 0) {
//       const totalQuantity = matchingHaves.reduce((sum, card) => sum + (card.quantity || 1), 0);
//       matches.push({
//         name: wantCard.name || matchingHaves[0].name,
//         quantity: totalQuantity,
//         foiling: wantCard.foiling || matchingHaves[0].foiling || matchingHaves[0].printingDetails?.foiling
//       });
//     }
//   }

//   return matches;
// }

// /**
//  * Extract printing ID from card object
//  */
// function extractPrintingId(card) {
//   return card.printingId || 
//          card.printingDetails?.printing_id || 
//          card.printingDetails?.printingId ||
//          card.id ||
//          null;
// }

// /**
//  * Format the simple trade response
//  */
// function formatTradeResponse(tradeMatches, targetUser) {
//   const { youHaveTheyWant, theyHaveYouWant } = tradeMatches;
//   const targetName = targetUser.username || targetUser.discordUsername || `User ${targetUser.discordId}`;
  
//   let content = `**Trade with ${targetName}:**\n\n`;
  
//   // What they have that you want
//   if (theyHaveYouWant.length > 0) {
//     content += `**They have for you:**\n`;
//     theyHaveYouWant.slice(0, 10).forEach(card => {
//       const foiling = card.foiling ? ` (${card.foiling})` : '';
//       content += `${card.quantity}x ${card.name}${foiling}\n`;
//     });
//     if (theyHaveYouWant.length > 10) {
//       content += `... and ${theyHaveYouWant.length - 10} more\n`;
//     }
//     content += '\n';
//   }
  
//   // What you have that they want
//   if (youHaveTheyWant.length > 0) {
//     content += `**You have for them:**\n`;
//     youHaveTheyWant.slice(0, 10).forEach(card => {
//       const foiling = card.foiling ? ` (${card.foiling})` : '';
//       content += `${card.quantity}x ${card.name}${foiling}\n`;
//     });
//     if (youHaveTheyWant.length > 10) {
//       content += `... and ${youHaveTheyWant.length - 10} more\n`;
//     }
//   }
  
//   // No matches found
//   if (theyHaveYouWant.length === 0 && youHaveTheyWant.length === 0) {
//     content += `No trade matches found with ${targetName}.`;
//   }

//   // Truncate if too long for Discord
//   if (content.length > 2000) {
//     content = content.substring(0, 1900) + '\n... (message truncated)';
//   }

//   return createSuccessResponse(content, true);
// }
// // // app/discord-v2/commands/trade-analysis.js
// // import { connectToDatabase } from "@/lib/mongodb";
// // import User from "@/models/User";
// // import WantsList from "@/models/WantsList";
// // import Binder from "@/models/Binder";
// // import mongoose from "mongoose";
// // import { createErrorResponse, createSuccessResponse } from '../responses.js';

// // /**
// //  * Handle /trade command - analyze trade compatibility between two users
// //  * @param {Object} body - The Discord interaction body
// //  * @param {Array} options - The command options from Discord
// //  * @returns {NextResponse} Discord interaction response
// //  */
// // export async function handleTradeAnalysis(body, options) {
// //   try {
// //     // Extract the requesting user's Discord ID
// //     const requestingDiscordId = body.member?.user?.id || body.user?.id;
    
// //     if (!requestingDiscordId) {
// //       return createErrorResponse("Could not identify requesting user.", true);
// //     }

// //     // Extract target user from options
// //     const targetUserOption = options?.find(opt => opt.name === 'user');

// //     if (!targetUserOption?.value) {
// //       return createErrorResponse("Please specify a user to analyze trades with.", true);
// //     }

// //     const targetDiscordId = targetUserOption.value;

// //     // Prevent self-analysis
// //     if (targetDiscordId === requestingDiscordId) {
// //       return createErrorResponse("You cannot analyze trades with yourself!", true);
// //     }

// //     console.log(`[Discord] Trade analysis: ${requestingDiscordId} vs ${targetDiscordId}`);

// //     await connectToDatabase();

// //     // Find both users by Discord IDs
// //     const [requestingUser, targetUser] = await Promise.all([
// //       User.findOne({ discordId: requestingDiscordId }),
// //       User.findOne({ discordId: targetDiscordId })
// //     ]);

// //     if (!requestingUser) {
// //       return createErrorResponse("You don't have a registered account. Please register first!", true);
// //     }

// //     if (!targetUser) {
// //       return createErrorResponse("Target user doesn't have a registered account.", true);
// //     }

// //     // Perform trade analysis
// //     const analysis = await performTradeAnalysis(
// //       requestingUser._id.toString(),
// //       targetUser._id.toString(),
// //       true // Always include cards for the simple list
// //     );

// //     // Format response as simple list
// //     return formatSimpleTradeResponse(analysis, targetUser);

// //   } catch (error) {
// //     console.error("[Discord] Error in handleTradeAnalysis:", error);
// //     return createErrorResponse(`Error analyzing trade compatibility: ${error.message}`);
// //   }
// // }

// // /**
// //  * Perform the actual trade analysis between two users
// //  */
// // async function performTradeAnalysis(currentUserId, targetUserId, includeCards = false) {
// //   const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
// //   const targetUserObjectId = new mongoose.Types.ObjectId(targetUserId);

// //   // Parallel data fetching for better performance
// //   const [
// //     targetWantsLists,
// //     currentUserBinders,
// //     targetUserBinders,
// //     currentUserWantsLists
// //   ] = await Promise.all([
// //     WantsList.find({
// //       $or: [{ userId: targetUserId }, { userId: targetUserObjectId }],
// //     }),
// //     Binder.find({
// //       $or: [{ userId: currentUserId }, { userId: currentUserObjectId }],
// //       archived: { $ne: true },
// //     }),
// //     Binder.find({
// //       $or: [{ userId: targetUserId }, { userId: targetUserObjectId }],
// //       archived: { $ne: true },
// //     }),
// //     WantsList.find({
// //       $or: [{ userId: currentUserId }, { userId: currentUserObjectId }],
// //     })
// //   ]);

// //   // Process data
// //   const targetWantsCards = targetWantsLists.flatMap(list => list.cards || []);
// //   const currentUserHaves = currentUserBinders.flatMap(b => (b.cards || []).filter(card => card.forTrade));
// //   const targetUserHaves = targetUserBinders.flatMap(b => (b.cards || []).filter(card => card.forTrade));
// //   const currentUserWantsCards = currentUserWantsLists.flatMap(list => list.cards || []);

// //   // Calculate total quantities
// //   const targetWantsTotalQuantity = targetWantsCards.reduce((sum, card) => sum + (card.quantity || 1), 0);
// //   const currentUserWantsTotalQuantity = currentUserWantsCards.reduce((sum, card) => sum + (card.quantity || 1), 0);

// //   // Helper function to extract printing ID consistently
// //   function extractPrintingId(card) {
// //     return card.printingId || 
// //            card.printingDetails?.printing_id || 
// //            card.printingDetails?.printingId ||
// //            card.id ||
// //            null;
// //   }

// //   // Helper function to get card value
// //   function getCardValue(card) {
// //     const price = card.printingDetails?.tcg_market || 
// //                   card.printingDetails?.tcgMarket ||
// //                   card.priceInfo?.tcgMarket ||
// //                   card.tcg_market ||
// //                   0;
    
// //     return typeof price === 'number' ? price : 0;
// //   }

// //   // Calculate "You Have Their Wants"
// //   let youHaveTheirWantsCount = 0;
// //   let youHaveTheirWantsTotalQuantity = 0;
// //   let youHaveTheirWantsTotalValue = 0;
// //   const youHaveTheirWantsDetails = [];

// //   for (const targetWant of targetWantsCards) {
// //     const targetPrintingId = extractPrintingId(targetWant);
// //     if (!targetPrintingId) continue;

// //     const targetPrintingIdLower = targetPrintingId.toLowerCase();
// //     const matchingHaves = currentUserHaves.filter(have => {
// //       const havePrintingId = extractPrintingId(have);
// //       return havePrintingId && havePrintingId.toLowerCase() === targetPrintingIdLower;
// //     });

// //     if (matchingHaves.length > 0) {
// //       youHaveTheirWantsCount++;
// //       const totalQuantity = matchingHaves.reduce((sum, h) => sum + (h.quantity || 1), 0);
// //       youHaveTheirWantsTotalQuantity += totalQuantity;

// //       const cardValue = getCardValue(matchingHaves[0]);
// //       const totalCardValue = cardValue * totalQuantity;
// //       youHaveTheirWantsTotalValue += totalCardValue;

// //       if (includeCards) {
// //         youHaveTheirWantsDetails.push({
// //           name: targetWant.name || matchingHaves[0].name,
// //           printingId: targetPrintingId,
// //           quantity: totalQuantity,
// //           unitValue: cardValue,
// //           totalValue: totalCardValue,
// //           set: targetWant.set || matchingHaves[0].set || matchingHaves[0].printingDetails?.set_id,
// //           foiling: targetWant.foiling || matchingHaves[0].foiling || matchingHaves[0].printingDetails?.foiling,
// //         });
// //       }
// //     }
// //   }

// //   // Calculate "They Have Your Wants"
// //   let theyHaveYourWantsCount = 0;
// //   let theyHaveYourWantsTotalQuantity = 0;
// //   let theyHaveYourWantsTotalValue = 0;
// //   const theyHaveYourWantsDetails = [];

// //   for (const currentUserWant of currentUserWantsCards) {
// //     const currentUserWantPrintingId = extractPrintingId(currentUserWant);
// //     if (!currentUserWantPrintingId) continue;

// //     const currentUserWantPrintingIdLower = currentUserWantPrintingId.toLowerCase();
    
// //     const matchingHaves = targetUserHaves.filter(have => {
// //       const havePrintingId = extractPrintingId(have);
// //       return havePrintingId && havePrintingId.toLowerCase() === currentUserWantPrintingIdLower;
// //     });

// //     if (matchingHaves.length > 0) {
// //       theyHaveYourWantsCount++;
// //       const totalQuantity = matchingHaves.reduce((sum, h) => sum + (h.quantity || 1), 0);
// //       theyHaveYourWantsTotalQuantity += totalQuantity;

// //       const cardValue = getCardValue(matchingHaves[0]);
// //       const totalCardValue = cardValue * totalQuantity;
// //       theyHaveYourWantsTotalValue += totalCardValue;

// //       if (includeCards) {
// //         theyHaveYourWantsDetails.push({
// //           name: currentUserWant.name,
// //           printingId: currentUserWantPrintingId,
// //           quantity: totalQuantity,
// //           unitValue: cardValue,
// //           totalValue: totalCardValue,
// //           set: currentUserWant.set || matchingHaves[0].set || matchingHaves[0].printingDetails?.set_id,
// //           foiling: currentUserWant.foiling || matchingHaves[0].foiling || matchingHaves[0].printingDetails?.foiling,
// //         });
// //       }
// //     }
// //   }

// //   // Calculate rates and metrics
// //   const youHaveTheirWantsRate = targetWantsTotalQuantity > 0 
// //     ? (youHaveTheirWantsTotalQuantity / targetWantsTotalQuantity) * 100 
// //     : 0;

// //   const theyHaveYourWantsRate = currentUserWantsTotalQuantity > 0 
// //     ? (theyHaveYourWantsTotalQuantity / currentUserWantsTotalQuantity) * 100 
// //     : 0;

// //   // Calculate compatibility score
// //   const compatibilityScore = calculateCompatibilityScore({
// //     youHaveRate: youHaveTheirWantsRate,
// //     theyHaveRate: theyHaveYourWantsRate,
// //     youHaveCount: youHaveTheirWantsCount,
// //     theyHaveCount: theyHaveYourWantsCount,
// //     totalMutualCards: youHaveTheirWantsCount + theyHaveYourWantsCount,
// //     valueBalance: Math.abs(youHaveTheirWantsTotalValue - theyHaveYourWantsTotalValue)
// //   });

// //   const tradePotential = getTradesPotential(compatibilityScore);
// //   const valueDifference = youHaveTheirWantsTotalValue - theyHaveYourWantsTotalValue;
// //   const balanceStatus = getBalanceStatus(valueDifference);

// //   return {
// //     youHaveTheirWants: {
// //       count: youHaveTheirWantsCount,
// //       totalQuantity: youHaveTheirWantsTotalQuantity,
// //       totalValue: youHaveTheirWantsTotalValue,
// //       rate: youHaveTheirWantsRate,
// //       details: youHaveTheirWantsDetails
// //     },
// //     theyHaveYourWants: {
// //       count: theyHaveYourWantsCount,
// //       totalQuantity: theyHaveYourWantsTotalQuantity,
// //       totalValue: theyHaveYourWantsTotalValue,
// //       rate: theyHaveYourWantsRate,
// //       details: theyHaveYourWantsDetails
// //     },
// //     compatibilityScore,
// //     tradePotential,
// //     valueDifference: Math.abs(valueDifference),
// //     balanceStatus,
// //     totalMutualCards: youHaveTheirWantsCount + theyHaveYourWantsCount,
// //     hasMutualInterest: youHaveTheirWantsCount > 0 && theyHaveYourWantsCount > 0
// //   };
// // }

// // /**
// //  * Format the trade analysis response as a simple list (like your UI component)
// //  */
// // function formatSimpleTradeResponse(analysis, targetUser) {
// //   const {
// //     youHaveTheirWants,
// //     theyHaveYourWants,
// //   } = analysis;

// //   const targetUsername = targetUser.username || targetUser.discordUsername || `User ${targetUser.discordId}`;
  
// //   let content = `**Trade with ${targetUsername}:**\n\n`;
  
// //   // They have for you section
// //   if (theyHaveYourWants.details.length > 0) {
// //     content += `**They have for you:**\n`;
// //     theyHaveYourWants.details.slice(0, 10).forEach(card => {
// //       const foiling = card.foiling ? ` ${card.foiling}` : '';
// //       content += `${card.quantity}x ${card.name}${foiling}\n`;
// //     });
// //     if (theyHaveYourWants.details.length > 10) {
// //       content += `... and ${theyHaveYourWants.details.length - 10} more\n`;
// //     }
// //     content += '\n';
// //   }
  
// //   // You have for them section
// //   if (youHaveTheirWants.details.length > 0) {
// //     content += `**You have for them:**\n`;
// //     youHaveTheirWants.details.slice(0, 10).forEach(card => {
// //       const foiling = card.foiling ? ` ${card.foiling}` : '';
// //       content += `${card.quantity}x ${card.name}${foiling}\n`;
// //     });
// //     if (youHaveTheirWants.details.length > 10) {
// //       content += `... and ${youHaveTheirWants.details.length - 10} more\n`;
// //     }
// //   }
  
// //   // If no matches
// //   if (theyHaveYourWants.details.length === 0 && youHaveTheirWants.details.length === 0) {
// //     content += `No trade matches found between you and ${targetUsername}.`;
// //   }

// //   // Check Discord message length limit
// //   if (content.length > 2000) {
// //     content = content.substring(0, 1900) + '\n... (truncated)';
// //   }

// //   return createSuccessResponse(content, true);
// // }

// // // Helper functions (same as your original route)
// // function calculateCompatibilityScore(metrics) {
// //   const { youHaveRate, theyHaveRate, youHaveCount, theyHaveCount, totalMutualCards, valueBalance } = metrics;
  
// //   const mutualInterestScore = Math.min(40, totalMutualCards * 4);
// //   const balanceScore = youHaveCount > 0 && theyHaveCount > 0 
// //     ? 30 - (Math.abs(youHaveRate - theyHaveRate) / 4)
// //     : 0;
// //   const rateScore = ((youHaveRate + theyHaveRate) / 2) * 0.2;
// //   const valueScore = valueBalance < 10 ? 10 : Math.max(0, 10 - (valueBalance / 10));
  
// //   return Math.min(100, mutualInterestScore + balanceScore + rateScore + valueScore);
// // }

// // function getTradesPotential(score) {
// //   if (score >= 70) return "high";
// //   if (score >= 40) return "medium";
// //   return "low";
// // }

// // function getBalanceStatus(valueDifference) {
// //   if (Math.abs(valueDifference) < 5) return "balanced";
// //   return valueDifference > 0 ? "you_ahead" : "they_ahead";
// // }