// app/discord-v2/commands/publicComponents.js
import { userService, binderService } from '@/lib/services';
import { createErrorResponse } from '../responses.js';
import { fetchBinderByDiscord } from '../utils.js';
import { handleSpecificBinderPublic } from './contextMenu.js';
import { NextResponse } from 'next/server';
import { InteractionResponseType } from 'discord-interactions';

/**
 * Handle public binder selection dropdown
 * @param {string} customId - The interaction custom_id
 * @param {Object} body - Discord interaction body
 * @returns {NextResponse} Response
 */
export async function handlePublicBinderSelect(customId, body) {
  const [_, targetDiscordId] = customId.split(':');
  const selectedSlug = body.data.values[0];
  
  // Check if this is the user selecting their own binder
  const isOwnBinder = body.member?.user?.id === targetDiscordId;
  
  return await handleSpecificBinderPublic(targetDiscordId, selectedSlug, isOwnBinder);
}

/**
 * Handle public binder pagination
 * @param {string} customId - The interaction custom_id
 * @param {Object} body - Discord interaction body
 * @returns {NextResponse} Response
 */
export async function handlePublicBinderPage(customId, body) {
  const [_, discordId, slug, pageStr] = customId.split(':');
  const page = parseInt(pageStr || '0', 10);
  
  const result = await fetchBinderByDiscord(discordId, slug);
  if (result.error) {
    return createErrorResponse(result.error, false);
  }
  
  const binder = result.binder;
  
  // Check if this is the user's own binder
  const isOwnBinder = body.member?.user?.id === discordId;
  
  // ADD VISIBILITY CHECK - only if it's not the user's own binder
  if (!isOwnBinder) {
    if (binder.visibility?.allowDiscordCommands === false) {
      return createErrorResponse('This binder is not available for Discord viewing.', false);
    }
    
    // Backwards compatibility - if no visibility field, check isPublic
    if (!binder.visibility && binder.isPublic === false) {
      return createErrorResponse('This binder is private.', false);
    }
  }
  
  // Fetch inventory items via service layer
  const itemsResult = await binderService.getBinderCards(
    binder._id,
    {}, // No filters
    { limit: 10000, sortBy: 'default' }
  );
  const inventoryItems = itemsResult.success ? itemsResult.data.cards : [];
  
  // Import the pagination function
  const { paginateBinderCards } = await import('../utils/paginateBinderCards.ts');
  
  // FIXED: Pass inventoryItems to the pagination function
  const { content, components } = paginateBinderCards(binder, inventoryItems, discordId, slug, page);
  
  // Update pagination buttons to use public custom_ids  
  const publicComponents = components.map(component => ({
    ...component,
    components: component.components.map(button => ({
      ...button,
      custom_id: button.custom_id.replace('binder_page:', 'public_binder_page:')
    }))
  }));
  
  return NextResponse.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: { content, components: publicComponents, flags: 4 }, // SUPPRESS_EMBEDS
  });
}

/**
 * Handle public wants list pagination
 * @param {string} customId - The interaction custom_id
 * @param {Object} body - Discord interaction body
 * @returns {NextResponse} Response
 */
export async function handlePublicWantsPage(customId, body) {
  const [_, discordId, userId, pageStr] = customId.split(':');
  const page = parseInt(pageStr || '0', 10);

  try {
    // Import required modules
    const { paginateWantsListCards } = await import('../utils/paginateWantsCards.ts');

    // Get user via service layer
    const userResult = await userService.findByDiscordId(discordId);
    if (!userResult.success || !userResult.data) {
      return createErrorResponse('User not found.', false); // PUBLIC error
    }
    const user = userResult.data;

    // Fetch wants list via API endpoint
    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/wants/user/${user._id.toString()}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.success) {
      return createErrorResponse(data.error || 'Wants list not found.', false); // PUBLIC error
    }

    const wantsList = data.wantsList;

    // Generate paginated content
    const username = user.username || user.discordUsername || 'User';
    const { content, components } = paginateWantsListCards(wantsList, discordId, username, page);

    // Check if this is the user checking their own wants list
    const isOwnWants = body.member?.user?.id === discordId;

    // Update content for public view
    const publicContent = isOwnWants
      ? `🎯 **Your Wants List** (Public View)\n` + content.split('\n').slice(1).join('\n')
      : `🎯 **${username}'s Wants List** (Public View)\n` + content.split('\n').slice(1).join('\n');

    // Update pagination buttons to use public custom_ids
    const publicComponents = components ? components.map(component => ({
      ...component,
      components: component.components.map(button => ({
        ...button,
        custom_id: button.custom_id.replace('wants_page:', 'public_wants_page:')
      }))
    })) : [];

    // Return updated PUBLIC message
    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: publicContent,
        components: publicComponents
        // No flags = PUBLIC message
      },
    });

  } catch (error) {
    console.error(`[Discord V2] Error handling public wants pagination:`, error);
    return createErrorResponse(`Error loading page: ${error.message}`, false); // PUBLIC error
  }
}