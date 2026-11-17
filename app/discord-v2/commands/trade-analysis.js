// app/discord-v2/commands/trade-analysis.js
import { userService, inventoryService, locationService } from '@/lib/services';
import { displayUsername, profileHref } from '@/lib/utils/display-username';
import { FOILING_MAP } from '@/lib/fab-constants';
import { createErrorResponse, createSuccessResponse } from '../responses.js';

/**
 * Handle /trade — 1:1 trade view with a user (inventoryService.getUserTradeMatches,
 * exact printing by default, any_printing = loose), or every match at a store.
 */
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
    const mode = options?.find(opt => opt.name === 'any_printing')?.value === true ? 'loose' : 'exact';

    const matchResult = await inventoryService.getUserTradeMatches(
      requestingUser._id.toString(),
      targetUser._id.toString(),
      mode
    );
    if (!matchResult.success) {
      return createErrorResponse("Failed to load trade matches.", true);
    }
    return formatTradeResponse(matchResult.data, targetUser, mode);

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

function describeCard(card) {
  const foil = FOILING_MAP[String(card.foiling || '').toLowerCase()];
  const details = [card.collectorNumber || card.set?.toUpperCase(), foil && foil !== 'Non-foil' ? foil : null]
    .filter(Boolean)
    .join(', ');
  return `${card.quantity}x ${card.displayName}${details ? ` (${details})` : ''}`;
}

function formatSection(title, cards) {
  if (cards.length === 0) return '';
  let text = `**${title}:**\n`;
  text += cards.slice(0, 10).map(describeCard).join('\n') + '\n';
  if (cards.length > 10) text += `... and ${cards.length - 10} more\n`;
  return text + '\n';
}

/**
 * Format the 1:1 trade response (UserTradeMatchesDTO) with a link to the web
 * trade page, which has images, prices and one-click binder requests.
 */
function formatTradeResponse(matches, targetUser, mode) {
  const rawName = targetUser.username || targetUser.discordUsername || `User ${targetUser.discordId}`;
  const targetName = displayUsername(rawName);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app';
  const tradeUrl = `${baseUrl}${profileHref(rawName)}/trade${mode === 'loose' ? '?match=loose' : ''}`;
  const modeLabel = mode === 'loose' ? 'any printing' : 'exact printings';

  let content = `**Trade with ${targetName}** (${modeLabel}):\n\n`;
  content += formatSection('They have for you', matches.theyHaveYouWant);
  content += formatSection('You have for them', matches.theyWantYouHave);

  if (matches.theyHaveYouWant.length === 0 && matches.theyWantYouHave.length === 0) {
    content += `No trade matches found with ${targetName}.`;
    if (mode === 'exact') content += ' Try again with `any_printing: True` to match any version of the cards you want.';
    content += '\n\n';
  }

  const footer = `Full list: <${tradeUrl}>`;
  if (content.length + footer.length > 2000) {
    content = content.substring(0, 1990 - footer.length) + '\n...\n';
  }
  return createSuccessResponse(content + footer, true);
}
