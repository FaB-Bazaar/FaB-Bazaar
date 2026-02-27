// app/discord-v2/commands/wants.js
import { userService } from '@/lib/services';
import { createErrorResponse, createSuccessResponse, createComponentResponse } from '../responses.js';
import { paginateWantsListCards } from '../utils/paginateWantsCards.ts';

/**
 * Handle /wants command - displays a user's wants list with pagination
 * @param {Object} body - The Discord interaction body
 * @param {Array} options - The command options from Discord
 * @returns {NextResponse} Discord interaction response
 */
export async function handleWantsCommand(body, options) {
  try {
    // Extract user option
    const userOption = options?.find(opt => opt.name === 'user');
    const targetDiscordId = userOption?.value;

    if (!targetDiscordId) {
      return createErrorResponse('Please specify a user to view their wants list.', true);
    }

    console.log(`[Discord] /wants command - Looking up wants for discordId: ${targetDiscordId}`);

    // Find the user by Discord ID using service layer
    const userResult = await userService.findByDiscordId(targetDiscordId);
    console.log('[Discord] /wants - user lookup result:', userResult.success ? `Found: ${userResult.data.username || userResult.data.discordUsername}` : 'Not found');

    if (!userResult.success || !userResult.data) {
      console.error('[Discord] User lookup failed:', userResult.error);
      return createErrorResponse("User not found. They may need to register first or link their Discord account.", true);
    }

    const user = userResult.data;

    // Fetch wants list via API endpoint
    let wantsList;
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/wants/user/${user._id.toString()}`;
      console.log('[Discord] /wants - Fetching from API:', apiUrl);

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!data.success) {
        console.log('[Discord] /wants - API returned error:', data.error);
        if (response.status === 404) {
          const username = user.username || user.discordUsername || 'This user';
          return createSuccessResponse(`**${username}** has no cards in their wants list.`, true);
        }
        return createErrorResponse(data.error || 'Failed to retrieve wants list.', true);
      }

      wantsList = data.wantsList;
    } catch (apiError) {
      console.error('[Discord] Wants list API fetch failed:', apiError);
      return createErrorResponse('Failed to retrieve wants list. Please try again later.', true);
    }

    if (!wantsList || !wantsList.cards || !wantsList.cards.length) {
      const username = user.username || user.discordUsername || 'This user';
      return createSuccessResponse(`**${username}** has no cards in their wants list.`, true);
    }

    console.log(`[Discord] /wants - Found wants list with ${wantsList.cards.length} cards`);

    // Safety check for cards array
    if (!Array.isArray(wantsList.cards)) {
      console.error('[Discord] Wants list cards is not an array:', typeof wantsList.cards);
      return createErrorResponse('Wants list data is corrupted. Please contact support.', true);
    }

    // Use pagination for the wants list
    const username = user.username || user.discordUsername || 'User';
    const page = 0; // Start at first page
    const { content, components } = paginateWantsListCards(wantsList, targetDiscordId, username, page);

    // Check content length (Discord has 2000 char limit)
    console.log('[Discord] /wants - Content length:', content.length);
    if (content.length > 2000) {
      console.warn('[Discord] /wants - Content exceeds 2000 chars, Discord will reject it');
    }

    // Return paginated response (or simple success if no pagination needed)
    if (components && components.length > 0) {
      return createComponentResponse(content, components, true, true); // ephemeral, suppressEmbeds
    } else {
      return createSuccessResponse(content, true, true); // ephemeral, suppressEmbeds
    }

  } catch (error) {
    console.error('[Discord] Error in handleWantsCommand:', error);
    return createErrorResponse(`Error fetching wants list: ${error.message}`, true); // Make ephemeral
  }
}
