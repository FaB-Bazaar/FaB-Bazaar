// app/discord-v2/commands/contextMenu.js
import { userService, binderService } from '@/lib/services';
import { createErrorResponse, createSuccessResponse, createComponentResponse } from '../responses.js';
import { fetchBinderByDiscord } from '../utils.js';
import { NextResponse } from 'next/server';

/**
 * Handle public binder viewing from context menu
 * @param {string} targetDiscordId - Target user's Discord ID
 * @param {Object} body - Discord interaction body
 * @returns {NextResponse} Public binder response
 */
// export async function handlePublicBinder(targetDiscordId, body) {
//   try {
//     await connectToDatabase();
    
//     // Find the user
//     const user = await User.findOne({ discordId: targetDiscordId });
//     if (!user) {
//       return createErrorResponse("User not found.", false); // PUBLIC error
//     }

//     // Check if this is the user checking their own binders
//     const isOwnBinder = body.member?.user?.id === targetDiscordId;

//     let binderQuery;

//     if (isOwnBinder) {
//       // User checking their own binders - show all binders
//       binderQuery = { discordId: targetDiscordId };
//     } else {
//       // Someone else checking - only show binders that allow Discord commands
//       binderQuery = {
//         discordId: targetDiscordId,
//         $or: [
//           { 'visibility.allowDiscordCommands': true },
//           { visibility: { $exists: false }, isPublic: true } // backwards compatibility
//         ]
//       };
//     }

//     // Find binders with visibility filtering
//     const binders = await Binder.find(binderQuery);

export async function handlePublicBinder(targetDiscordId, body) {
  try {
    // Find the user via service layer
    const userResult = await userService.findByDiscordId(targetDiscordId);
    if (!userResult.success || !userResult.data) {
      return createErrorResponse("User not found.", false);
    }
    const user = userResult.data;

    console.log('[Debug] Target Discord ID:', targetDiscordId);
    console.log('[Debug] Found user ID:', user._id);

    // Check if this is the user checking their own binders
    const isOwnBinder = body.member?.user?.id === targetDiscordId;
    console.log('[Debug] Is own binder:', isOwnBinder);

    // Get all user binders via service layer
    const bindersResult = await binderService.getUserBindersWithStats(user._id);
    if (!bindersResult.success) {
      return createErrorResponse("Failed to fetch binders.", false);
    }

    // Apply visibility filtering
    let binders;
    if (isOwnBinder) {
      // User checking their own binders - show all
      binders = bindersResult.data;
    } else {
      // Someone else checking - only show binders that allow Discord commands
      binders = bindersResult.data.filter(b => {
        // Check new visibility settings
        if (b.visibility?.allowDiscordCommands === true) {
          return true;
        }
        // Backwards compatibility - if no visibility field, check isPublic
        if (!b.visibility && b.isPublic === true) {
          return true;
        }
        return false;
      });
    }

    console.log('[Debug] Binders found:', binders.length);
    binders.forEach((b, i) => {
      console.log(`[Debug] Binder ${i}:`, {
        name: b.name,
        discordId: b.discordId,
        userId: b.userId,
        visibility: b.visibility,
        isPublic: b.isPublic,
        allowDiscordCommands: b.visibility?.allowDiscordCommands
      });
    });
    
    if (!binders.length) {
      const message = isOwnBinder 
        ? "You don't have any binders yet."
        : "No public binders found for this user.";
      return createErrorResponse(message, false); // PUBLIC error
    }

    // If user has only one binder, show it directly (PUBLIC)
    if (binders.length === 1) {
      const binderSlug = binders[0].slug || binders[0].discordExternalId;
      return await handleSpecificBinderPublic(targetDiscordId, binderSlug, isOwnBinder);
    }

    // Multiple binders - show selection menu (PUBLIC)
    const username = user.username || user.discordUsername || `User ${targetDiscordId}`;
    
    const selectOptions = binders.map((binder) => {
      const slug = binder.slug || binder.discordExternalId;
      // BinderWithStatsDTO carries aggregates under `stats` — there is no
      // `cards` array on it (that was the MongoDB-era embedded shape, which
      // rendered every binder here as 0 cards / $0.00). Same fields as the
      // /binder API route: stats.totalQuantity + stats.totalValue.tcg_low.
      const cardCount = binder.stats?.totalQuantity || 0;
      const totalValue = binder.stats?.totalValue?.tcg_low || 0;

      return {
        label: `${binder.name} (${cardCount} cards)`.slice(0, 100),
        value: slug,
        description: `💰 $${totalValue.toFixed(0)}`.slice(0, 100)
      };
    });

    const selectMenu = {
      type: 1, // Action row
      components: [
        {
          type: 3, // String select menu
          custom_id: `public_binder_select:${targetDiscordId}`,
          placeholder: 'Select a binder to view publicly',
          min_values: 1,
          max_values: 1,
          options: selectOptions,
        },
      ],
    };

    const headerText = isOwnBinder 
      ? `📂 **Your Binders (${binders.length}):**\nEveryone can see this - select a binder to view.`
      : `📂 **${username}'s Binders (${binders.length}):**\nEveryone can see this - select a binder to view.`;

    return createComponentResponse(
      headerText, 
      [selectMenu], 
      false // PUBLIC - no ephemeral flag
    );

  } catch (error) {
    console.error('[Discord V2] Error in handlePublicBinder:', error);
    return createErrorResponse(`Error fetching public binder: ${error.message}`, false);
  }
}

/**
 * Handle specific public binder display
 * @param {string} targetDiscordId - Target user's Discord ID  
 * @param {string} slug - Binder slug
 * @param {boolean} isOwnBinder - Whether user is viewing their own binder
 * @returns {NextResponse} Public binder content
 */
export async function handleSpecificBinderPublic(targetDiscordId, slug, isOwnBinder = false) {
  // Step 1: Use existing fetchBinderByDiscord
  const result = await fetchBinderByDiscord(targetDiscordId, slug);
  
  if (result.error) {
    return createErrorResponse(result.error, false); // PUBLIC error
  }
  
  const binder = result.binder;
  
  // ADD VISIBILITY CHECK HERE - only if it's not the user's own binder
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
  
  if (!inventoryItems.length) {
    return createSuccessResponse(`📂 **${binder.name}** - No cards in this binder`, false); // PUBLIC
  }
  
  // Get username for display via service layer
  const userResult = await userService.findByDiscordId(targetDiscordId);
  const username = userResult.success
    ? (userResult.data.username || userResult.data.discordUsername || `User ${targetDiscordId}`)
    : `User ${targetDiscordId}`;
  
  // FIXED: Pass inventoryItems to pagination utility like the slash command
  const { paginateBinderCards } = await import('../utils/paginateBinderCards.ts');
  const paginationResult = paginateBinderCards(binder, inventoryItems, targetDiscordId, slug, 0);
  
  // Update the content to indicate it's public (unless it's their own binder)
  const publicContent = isOwnBinder 
    ? `📂 **Your ${binder.name}** (Public View)\n` + paginationResult.content.split('\n').slice(1).join('\n')
    : `📂 **${username}'s ${binder.name}** (Public View)\n` + paginationResult.content.split('\n').slice(1).join('\n');
  
  // Update pagination buttons to use public custom_ids
  const publicComponents = paginationResult.components.map(component => ({
    ...component,
    components: component.components.map(button => ({
      ...button,
      custom_id: button.custom_id.replace('binder_page:', 'public_binder_page:')
    }))
  }));
  
  return NextResponse.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content: publicContent.length > 2000 ?
        publicContent.substring(0, 1900) + '\n... (use pagination)' :
        publicContent,
      components: publicComponents,
      flags: 4 // SUPPRESS_EMBEDS
    }
  });
}

/**
 * Handle public wants viewing from context menu
 * @param {string} targetDiscordId - Target user's Discord ID
 * @param {Object} body - Discord interaction body
 * @returns {NextResponse} Public wants response
 */
export async function handlePublicWants(targetDiscordId, body) {
  try {
    console.log(`[Discord V2] Public wants - Looking up wants for discordId: ${targetDiscordId}`);

    // Find the user by Discord ID via service layer
    const userResult = await userService.findByDiscordId(targetDiscordId);
    console.log('[Discord V2] Public wants - user lookup result:', userResult.success ? `Found: ${userResult.data.username || userResult.data.discordUsername}` : 'Not found');

    if (!userResult.success || !userResult.data) {
      console.error('[Discord V2] User lookup failed:', userResult.error);
      return createErrorResponse("User not found. They may need to register first or link their Discord account.", false); // PUBLIC error
    }
    const user = userResult.data;

    // Fetch wants list via API endpoint
    let wantsList;
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/wants/user/${user._id.toString()}`;
      console.log('[Discord V2] Public wants - Fetching from API:', apiUrl);

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!data.success) {
        console.log('[Discord V2] Public wants - API returned error:', data.error);
        if (response.status === 404) {
          const username = user.username || user.discordUsername || 'This user';
          return createSuccessResponse(`**${username}** has no cards in their wants list.`, false);
        }
        return createErrorResponse(data.error || 'Failed to retrieve wants list.', false);
      }

      wantsList = data.wantsList;
    } catch (apiError) {
      console.error('[Discord V2] Wants list API fetch failed:', apiError);
      return createErrorResponse('Failed to retrieve wants list. Please try again later.', false); // PUBLIC error
    }

    if (!wantsList || !wantsList.cards || !wantsList.cards.length) {
      const username = user.username || user.discordUsername || 'This user';
      return createSuccessResponse(`**${username}** has no cards in their wants list.`, false); // PUBLIC response
    }

    console.log(`[Discord V2] Public wants - Found wants list with ${wantsList.cards.length} cards`);
    
    // Safety check for cards array
    if (!Array.isArray(wantsList.cards)) {
      console.error('[Discord V2] Wants list cards is not an array:', typeof wantsList.cards);
      return createErrorResponse('Wants list data is corrupted. Please contact support.', false); // PUBLIC error
    }
    
    // Use pagination for the wants list - but make it PUBLIC
    const username = user.username || user.discordUsername || 'User';
    const page = 0; // Start at first page
    const { paginateWantsListCards } = await import('../utils/paginateWantsCards.ts');
    const { content, components } = paginateWantsListCards(wantsList, targetDiscordId, username, page);
    
    // Check if this is the user checking their own wants list
    const isOwnWants = body.member?.user?.id === targetDiscordId;
    
    // Update the content to indicate it's public
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
    
    // Return public response
    return NextResponse.json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: publicContent.length > 2000 ?
          publicContent.substring(0, 1900) + '\n... (use pagination)' :
          publicContent,
        components: publicComponents,
        flags: 4 // SUPPRESS_EMBEDS — stays public, just no per-card link previews
      }
    });
    
  } catch (error) {
    console.error('[Discord V2] Error in handlePublicWants:', error);
    return createErrorResponse(`Error fetching public wants list: ${error.message}`, false); // PUBLIC error
  }
}
