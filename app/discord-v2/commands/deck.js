// app/discord-v2/commands/deck.js
import { userService, deckService } from '@/lib/services';
import { createErrorResponse, createSuccessResponse, createComponentResponse } from '../responses.js';
import { paginateDeckList } from '../utils/paginateDeckList.ts';

/**
 * Handle /deck command - shows a user's deck list with pagination
 * @param {Object} body - The Discord interaction body
 * @param {Array} options - The command options from Discord
 * @returns {NextResponse} Discord interaction response
 */
export async function handleDeckCommand(body, options) {
  try {
    const requestingDiscordId = body.member?.user?.id || body.user?.id;
    const userOption = options?.find(opt => opt.name === 'user');
    const targetDiscordId = userOption?.value || requestingDiscordId;
    const isViewingOwn = targetDiscordId === requestingDiscordId;

    console.log(`[Discord] /deck command - Looking up decks for discordId: ${targetDiscordId}`);

    // Find the target user by Discord ID
    const userResult = await userService.findByDiscordId(targetDiscordId);
    if (!userResult.success || !userResult.data) {
      return createErrorResponse(
        isViewingOwn
          ? 'Could not find your account. Make sure your Discord is linked at FaB Bazaar.'
          : 'User not found. They may need to register or link their Discord account.',
        true
      );
    }

    const user = userResult.data;
    const username = user.username || user.discordUsername || 'User';
    console.log(`[Discord] /deck - Found user: ${username}`);

    // Fetch the user's decks (lightweight summary format)
    const decksResult = await deckService.listUserDecksBasic(user._id.toString());
    if (!decksResult.success) {
      console.error('[Discord] /deck - Failed to fetch decks:', decksResult.error);
      return createErrorResponse('Failed to retrieve decks. Please try again later.', true);
    }

    let decks = decksResult.data;

    // If viewing another user's decks, only show public ones
    if (!isViewingOwn) {
      decks = decks.filter(d => d.isPublic);
    }

    console.log(`[Discord] /deck - Found ${decks.length} deck(s) for ${username}`);

    if (!decks.length) {
      const msg = isViewingOwn
        ? "You don't have any decks yet. Create one at FaB Bazaar!"
        : `**${username}** has no public decks.`;
      return createSuccessResponse(msg, true);
    }

    const { content, components } = paginateDeckList(
      decks,
      requestingDiscordId,
      targetDiscordId,
      username,
      0
    );

    if (components.length > 0) {
      return createComponentResponse(content, components, true, true); // ephemeral, suppressEmbeds
    }
    return createSuccessResponse(content, true, true); // ephemeral, suppressEmbeds

  } catch (error) {
    console.error('[Discord] Error in handleDeckCommand:', error);
    return createErrorResponse(`Error fetching decks: ${error.message}`, true);
  }
}
