// app/discord-v2/commands/binder.js - REFACTORED to use API routes (database-agnostic)
import { createErrorResponse, createSuccessResponse, createComponentResponse } from '../responses.js';
import { paginateBinderCards } from '../utils/paginateBinderCards.ts';
import { NextResponse } from 'next/server';

/**
 * Fetch binder data from the Discord binder API
 * @param {string} requestingDiscordId - The Discord ID of the user making the request (for auth via bot token)
 * @param {string} targetDiscordId - The Discord ID of the user whose binders to fetch
 * @param {string} slug - Optional binder slug (if omitted, lists all binders)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function fetchFromBinderAPI(requestingDiscordId, targetDiscordId, slug = null) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app';

  // Build URL with targetDiscordId as the target user param
  // The requester is authenticated via X-Discord-Bot-Token + X-Discord-User-Id headers
  let url = `${baseUrl}/api/discord/binder?targetDiscordId=${encodeURIComponent(targetDiscordId)}`;
  if (slug) {
    url += `&slug=${encodeURIComponent(slug)}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'X-Discord-Bot-Token': process.env.DISCORD_BOT_TOKEN || '',
        'X-Discord-User-Id': requestingDiscordId, // This is used for auth (requester identity)
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'API request failed' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[Discord Binder] API fetch error:', error);
    return { success: false, error: error.message || 'Failed to fetch from API' };
  }
}

function getBinderSlug(binder) {
  return binder.slug || binder.discordExternalId || binder._id;
}

// handleListBinders - Now uses API route
export async function handleListBinders(body, options) {
  const requestingDiscordId = body.member?.user?.id || body.user?.id;
  // Default to requester's own binders if no user option provided
  const targetDiscordId = options?.[0]?.options?.[0]?.value || options?.[0]?.value || requestingDiscordId;

  if (!targetDiscordId) {
    return createErrorResponse("Could not determine target user.", true);
  }

  try {
    // Fetch binders via API (no slug = list mode)
    const result = await fetchFromBinderAPI(requestingDiscordId, targetDiscordId);

    if (!result.success) {
      if (result.error === "User not found") {
        return createErrorResponse("User not found.", true);
      }
      return createErrorResponse(`Failed to retrieve binders: ${result.error}`);
    }

    const { binders, user } = result.data;

    if (!binders || !binders.length) {
      return createErrorResponse("No accessible binders found for this user.", true);
    }

    const binderLines = binders.map(binder =>
      `slug: "${getBinderSlug(binder)}", name: "${binder.name}"`
    ).join('\n');

    return createSuccessResponse(`Binders for <@${targetDiscordId}>:\n${binderLines}`);
  } catch (error) {
    console.error('[Discord] Error in handleListBinders:', error);
    return createErrorResponse(`Failed to retrieve binders: ${error.message}`);
  }
}

// handleBinderCommand - Now uses API route
export async function handleBinderCommand(body, options) {
  console.log('[Discord] Starting handleBinderCommand (v5 with API route)...');

  try {
    const userOption = options?.find(opt => opt.name === 'user');
    const targetDiscordId = userOption?.value || body.member?.user?.id || body.user?.id;
    const requestingDiscordId = body.member?.user?.id || body.user?.id;

    if (!targetDiscordId) return createErrorResponse('Could not determine target user');

    // Fetch binders via API (no slug = list mode)
    const result = await fetchFromBinderAPI(requestingDiscordId, targetDiscordId);

    if (!result.success) {
      if (result.error === "User not found") {
        return createErrorResponse("User not found.", true);
      }
      return createErrorResponse(`Error fetching binder: ${result.error}`);
    }

    const { binders, user } = result.data;

    if (!binders || !binders.length) {
      return createErrorResponse("No accessible binders found for this user.", true);
    }

    // If only one binder, show it directly
    if (binders.length === 1) {
      const binderSlug = getBinderSlug(binders[0]);
      return await handleSpecificBinder(requestingDiscordId, targetDiscordId, binderSlug);
    }

    // Multiple binders - show dropdown menu
    // The API already returns cardCount and totalValue for each binder
    const selectOptions = binders.map((binder) => {
      const slug = getBinderSlug(binder);
      const cardCount = binder.cardCount || 0;
      const totalValue = binder.totalValue || 0;

      // Validate select option
      if (!slug || slug.length === 0) {
        console.error('[Discord Binder] Invalid slug for binder:', binder.name);
      }

      return {
        label: `${binder.name} (${cardCount} cards)`.slice(0, 100),
        value: slug,
        description: `💰 ~$${totalValue}`.slice(0, 100)
      };
    });

    const selectMenu = {
      type: 1,
      components: [{
        type: 3,
        custom_id: `binder_select:${targetDiscordId}`,
        placeholder: 'Select a binder to view',
        options: selectOptions,
      }],
    };

    const username = user?.username || `User ${targetDiscordId}`;

    console.log('[Discord Binder] Creating response with', binders.length, 'binders');
    console.log('[Discord Binder] Select options:', selectOptions.length);
    console.log('[Discord Binder] First option:', selectOptions[0]);

    const response = createComponentResponse(
      `**${username}'s Binders (${binders.length}):**\nSelect a binder to view its contents.`,
      [selectMenu],
      true
    );

    console.log('[Discord Binder] Response created, returning...');
    return response;

  } catch (error) {
    console.error('[Discord] Error in handleBinderCommand:', error);
    return createErrorResponse(`Error fetching binder: ${error.message}`);
  }
}

// handleSpecificBinder - Now uses API route
// @param {string} requestingDiscordId - The Discord ID of the user making the request (for auth)
// @param {string} targetDiscordId - The Discord ID of the user whose binder to fetch
// @param {string} slug - The binder slug
export async function handleSpecificBinder(requestingDiscordId, targetDiscordId, slug) {
  // Fetch binder with cards via API
  const result = await fetchFromBinderAPI(requestingDiscordId, targetDiscordId, slug);

  if (!result.success) {
    return createErrorResponse(result.error || "Failed to fetch binder", true);
  }

  const { binder, cards } = result.data;

  if (!cards || !cards.length) {
    return createSuccessResponse(`**${binder.name}** - No cards in this binder`, true);
  }

  // Pass both the binder and the cards to the pagination utility
  const paginationResult = paginateBinderCards(binder, cards, targetDiscordId, slug, 0);

  if (paginationResult.content.length > 2000) {
    const truncated = paginationResult.content.substring(0, 1900) + '\n... (truncated, use pagination)';
    return NextResponse.json({
      type: 4,
      data: { content: truncated, components: paginationResult.components, flags: 68 }
    });
  }

  return NextResponse.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content: paginationResult.content,
      components: paginationResult.components,
      flags: 68 // EPHEMERAL (64) + SUPPRESS_EMBEDS (4)
    }
  });
}