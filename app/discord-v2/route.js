// app/discord-v2/route.js
import { NextRequest, NextResponse } from 'next/server';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { verifyDiscordSignature } from './utils.js';
import { createErrorResponse, createSuccessResponse, createComponentResponse, createUpdateResponse, createSelectMenu } from './responses.js';
import { handleListBinders, handleSearchCommand, handleBinderCommand, handleTradeAnalysis, handleWantsCommand, handleDeckCommand } from './commands.js';
import { showCardPrintings } from './utils.js';

// Import the new context menu handlers
import {
  handlePublicBinder,
  handlePublicWants,
  handlePublicBinderSelect,
  handlePublicBinderPage,
  handlePublicWantsPage
} from './commands.js';

export async function POST(req) {
    // ... (This part of your file is correct and unchanged)
  // Extract Discord headers
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  // Validate required headers
  if (!signature || !timestamp || !publicKey) {
    return new NextResponse('Missing required Discord headers', { status: 400 });
  }

  // Get raw body for signature verification
  const rawBody = await req.text();

  // Verify Discord signature
  const isVerified = verifyDiscordSignature(signature, timestamp, rawBody, publicKey);
  if (!isVerified) {
    return new NextResponse('Invalid request signature', { status: 401 });
  }

  // Parse the request body
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    return createErrorResponse('Invalid JSON body');
  }

  // Handle Discord ping verification
  if (body.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // Handle slash commands
  if (body.type === InteractionType.APPLICATION_COMMAND) {
    return handleApplicationCommand(body);
  }

  // Handle component interactions (buttons, select menus, etc.)
  if (body.type === InteractionType.MESSAGE_COMPONENT) {
    return handleMessageComponent(body);
  }

  // Unknown interaction type
  return new NextResponse('Unhandled interaction type', { status: 400 });
}

async function handleApplicationCommand(body) {
    // ... (This function is correct and unchanged)
  const { name, options, type, target_id } = body.data;

  try {
    // Handle slash commands (type 1)
    if (type === 1 || !type) { // type defaults to 1 for slash commands
      switch (name) {
        case 'search':
          return await handleSearchCommand(body, options);

        case 'binder':
          return await handleBinderCommand(body, options);

        case 'wants':
          return await handleWantsCommand(body, options);

        case 'trade':
          return await handleTradeAnalysis(body, options);

        case 'deck':
          return await handleDeckCommand(body, options);

        default:
          return createErrorResponse(`Command not implemented yet: ${name}`);
      }
    }

    // Handle user context menu commands (type 2)
    if (type === 2) {
      const targetDiscordId = target_id;
      
      switch (name) {
        case 'Show Binder':
          try {
            const result = await handlePublicBinder(targetDiscordId, body);
            return result;
          } catch (error) {
            return createErrorResponse(`Public binder error: ${error.message}`, false);
          }

        case 'Show Wants List':
          try {
            const result = await handlePublicWants(targetDiscordId, body);
            return result;
          } catch (error) {
            return createErrorResponse(`Public wants error: ${error.message}`, false);
          }

        default:
          return createErrorResponse(`Context menu command not implemented: ${name}`);
      }
    }

    // Handle message context menu commands (type 3) - if needed in future
    if (type === 3) {
      return createErrorResponse('Message context menu commands not supported yet');
    }

    return createErrorResponse('Unknown command type');

  } catch (error) {
    return createErrorResponse(`Error processing command: ${error.message || error}`);
  }
}

// ⬇️ MODIFIED: The only change is in the 'binder_page' case within this function.
async function handleMessageComponent(body) {
  console.log('[Discord DEBUG] ===== MESSAGE COMPONENT RECEIVED =====');
  console.log('[Discord DEBUG] Full body:', JSON.stringify(body, null, 2));
  console.log('[Discord DEBUG] Custom ID:', body.data?.custom_id);
  console.log('[Discord DEBUG] Component type:', body.data?.component_type);
  console.log('[Discord DEBUG] =====================================');

  const customId = body.data.custom_id;
  const [action, ...rest] = customId.split(':');

  console.log('[Discord DEBUG] Parsed action:', action);
  console.log('[Discord DEBUG] Parsed rest:', rest);

  try {
    // ... (All other cases are correct and unchanged)
    if (action === 'public_binder_select') {
        // ...
      try {
        const result = await handlePublicBinderSelect(customId, body);
        return result;
      } catch (error) {
        return createErrorResponse(`Public binder select error: ${error.message}`, false);
      }
    }

    if (action === 'public_binder_page') {
        // ...
      try {
        const result = await handlePublicBinderPage(customId, body);
        return result;
      } catch (error) {
        return createErrorResponse(`Public binder page error: ${error.message}`, false);
      }
    }
    
    if (action === 'public_wants_page') {
        // ...
      try {
        const result = await handlePublicWantsPage(customId, body);
        return result;
      } catch (error) {
        return createErrorResponse(`Public wants page error: ${error.message}`, false);
      }
    }
    
    if (action === 'search_card_select') {
        // ...
      const [_, originalSearchTerm] = customId.split(':');
      const selectedCardUniqueId = body.data.values[0];
      
      // Get the card name from the selected option's label
      const selectedOption = body.data.resolved?.messages?.[0]?.components?.[0]?.components?.[0]?.options?.find(
        opt => opt.value === selectedCardUniqueId
      );
      const cardName = selectedOption?.label?.split(' -')[0] || originalSearchTerm;
      
      // Show all printings for the selected card
      const result = await showCardPrintings(selectedCardUniqueId, cardName);
      if (result.error) {
        return createErrorResponse(result.error, true);
      }
      
      return NextResponse.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: result.content,
          components: result.components || [], // Include action buttons if available
          flags: 64 // ephemeral
        },
      });
    }
    
    if (action === 'add_to_binder') {
      console.log('[Discord DEBUG] ✅ ENTERING add_to_binder handler');
      const [_, cardUniqueId, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      console.log('[Discord DEBUG] Decoded cardName:', cardName);
      console.log('[Discord DEBUG] CardUniqueId:', cardUniqueId);

      console.log('[Discord DEBUG] About to import and call handleAddToBinder...');
      const { handleAddToBinder } = await import('./commands.js');
      const result = await handleAddToBinder(body, cardUniqueId, cardName);
      console.log('[Discord DEBUG] handleAddToBinder result:', result);
      return result;
    }
    
    if (action === 'add_to_wants') {
        // ...
      const [_, cardUniqueId, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      
      const { handleAddToWants } = await import('./commands.js');
      return await handleAddToWants(body, cardUniqueId, cardName);
    }
    
    if (action === 'who_has') {
        // ...
      const [_, cardUniqueId, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);

      const { handleWhoHas } = await import('./commands.js');
      return await handleWhoHas(body, cardUniqueId, cardName);
    }

    if (action === 'who_wants') {
        // ...
      const [_, cardUniqueId, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);

      const { handleWhoWants } = await import('./commands.js');
      return await handleWhoWants(body, cardUniqueId, cardName);
    }

    if (action === 'select_printing_for_whowants') {
        // ...
      const [_, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      const selectedPrintingId = body.data.values[0];

      const { showWhoWantsPrinting } = await import('./commands.js');
      return await showWhoWantsPrinting(selectedPrintingId, cardName);
    }

    if (action === 'select_binder_for_add') {
        // ...
      const [_, cardUniqueId, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      const selectedBinder = body.data.values[0];
      
      const { handleBinderSelection } = await import('./commands.js');
      return await handleBinderSelection(body, cardUniqueId, cardName, selectedBinder);
    }
    
    if (action === 'select_printing_for_wants') {
        // ...
      const [_, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      const selectedPrintingId = body.data.values[0];
      const userId = body.member?.user?.id || body.user?.id;
      
      const { addPrintingToWants } = await import('./commands.js');
      return await addPrintingToWants(userId, selectedPrintingId, cardName);
    }
    
    if (action === 'select_printing_for_add') {
        // ...
      const [_, binderSlug, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      const selectedPrintingId = body.data.values[0];
      const userId = body.member?.user?.id || body.user?.id;
      
      const { addPrintingToBinder } = await import('./commands.js');
      return await addPrintingToBinder(userId, binderSlug, selectedPrintingId, cardName);
    }
    
    if (action === 'wants_page') {
        // ...
      const [_, discordId, userId, pageStr] = customId.split(':');
      const page = parseInt(pageStr || '0', 10);

      try {
        // Import required modules - NOTE THE .ts EXTENSION
        const { paginateWantsListCards } = await import('./utils/paginateWantsCards.ts');
        const { userService } = await import('@/lib/services');

        // Get user via service layer
        const userResult = await userService.findByDiscordId(discordId);
        if (!userResult.success || !userResult.data) {
          return createErrorResponse('User not found.', true);
        }
        const user = userResult.data;

        // Fetch wants list via API endpoint
        const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/wants/user/${user._id.toString()}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data.success) {
          return createErrorResponse(data.error || 'Wants list not found.', true);
        }

        const wantsList = data.wantsList;

        // Generate paginated content
        const username = user.username || user.discordUsername || 'User';
        const { content, components } = paginateWantsListCards(wantsList, discordId, username, page);

        // Return updated message
        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: { content, components },
        });

      } catch (error) {
        return createErrorResponse(`Error loading page: ${error.message}`, true);
      }
    }

    if (action === 'deck_page') {
      const [_, discordId, targetDiscordId, pageStr] = customId.split(':');
      const page = parseInt(pageStr || '0', 10);

      try {
        const { paginateDeckList } = await import('./utils/paginateDeckList.ts');
        const { userService, deckService } = await import('@/lib/services');

        const userResult = await userService.findByDiscordId(targetDiscordId);
        if (!userResult.success || !userResult.data) {
          return createErrorResponse('User not found.', true);
        }
        const user = userResult.data;
        const username = user.username || user.discordUsername || 'User';

        const decksResult = await deckService.listUserDecksBasic(user._id.toString());
        if (!decksResult.success) {
          return createErrorResponse('Failed to load decks.', true);
        }

        const isViewingOwn = discordId === targetDiscordId;
        const decks = isViewingOwn
          ? decksResult.data
          : decksResult.data.filter(d => d.isPublic);

        const { content, components } = paginateDeckList(decks, discordId, targetDiscordId, username, page);

        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: { content, components, flags: 68 }, // ephemeral + suppressEmbeds
        });
      } catch (error) {
        return createErrorResponse(`Error loading page: ${error.message}`, true);
      }
    }

    if (action === 'deck_select') {
      const discordId = body.member?.user?.id || body.user?.id;
      const publicId = body.data.values[0];

      try {
        const { deckService, userService } = await import('@/lib/services');
        const { paginateDeckContents } = await import('./utils/paginateDeckContents.ts');

        const deckResult = await deckService.findByPublicId(publicId);
        if (!deckResult.success || !deckResult.data) {
          return createErrorResponse('Deck not found.', true);
        }

        const deck = deckResult.data;
        if (!deck.isPublic) {
          // Look up the requesting user's internal ID to check ownership
          const userResult = await userService.findByDiscordId(discordId);
          const requestingUserId = userResult.success ? userResult.data?._id?.toString() : null;
          if (!requestingUserId || deck.userId?.toString() !== requestingUserId) {
            return createErrorResponse('This deck is private.', true);
          }
        }

        const { content, components } = paginateDeckContents(deck, discordId, 0);

        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: { content, components },
        });
      } catch (error) {
        return createErrorResponse(`Error loading deck: ${error.message}`, true);
      }
    }

    if (action === 'deck_contents_page') {
      const [_, discordId, publicId, pageStr] = customId.split(':');
      const page = parseInt(pageStr || '0', 10);

      try {
        const { deckService } = await import('@/lib/services');
        const { paginateDeckContents } = await import('./utils/paginateDeckContents.ts');

        const deckResult = await deckService.findByPublicId(publicId);
        if (!deckResult.success || !deckResult.data) {
          return createErrorResponse('Deck not found.', true);
        }

        const { content, components } = paginateDeckContents(deckResult.data, discordId, page);

        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: { content, components },
        });
      } catch (error) {
        return createErrorResponse(`Error loading page: ${error.message}`, true);
      }
    }

    if (action === 'select_printing_for_whohas') {
        // ...
      const [_, encodedCardName] = customId.split(':');
      const cardName = decodeURIComponent(encodedCardName);
      const selectedPrintingId = body.data.values[0];
      
      const { showWhoHasPrinting } = await import('./commands.js');
      return await showWhoHasPrinting(selectedPrintingId, cardName);
    }
    
    if (action === 'binder_select') {
        // ...
      const [_, targetDiscordId] = customId.split(':');
      const selectedSlug = body.data.values[0];
      const requestingDiscordId = body.member?.user?.id || body.user?.id;

      try {
        // Import and use the specific binder handler
        const { handleSpecificBinder } = await import('./commands/binder.js');
        const result = await handleSpecificBinder(requestingDiscordId, targetDiscordId, selectedSlug);
        
        // Extract the response data properly
        let responseData;
        if (result instanceof NextResponse) {
          // Parse NextResponse to get the data
          const resultBody = await result.text();
          const parsed = JSON.parse(resultBody);
          responseData = parsed.data;
        } else {
          responseData = result.data || result;
        }
        
        // Update the original interaction with the binder content
        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: responseData?.content || "Loading binder...",
            components: responseData?.components || [],
            flags: 64 // EPHEMERAL
          }
        });
        
      } catch (error) {
        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: `Error loading binder: ${error.message}`,
            components: [],
            flags: 64 // EPHEMERAL
          }
        });
      }
    }
    
    // --- ✅ START OF FIX ---
    if (action === 'binder_page') {
      try {
        const [_, discordId, slug, pageStr] = customId.split(':');
        const page = parseInt(pageStr || '0', 10);
        
        // Dynamically import models and utilities inside the handler
        const { paginateBinderCards } = await import('./utils/paginateBinderCards.ts');
        const { fetchBinderByDiscord } = await import('./utils.js');
        const { binderService } = await import('@/lib/services');

        // Step 1: Fetch the binder metadata (just like the original command)
        const result = await fetchBinderByDiscord(discordId, slug);
        if (result.error) {
          return createErrorResponse(result.error, true);
        }

        // Step 2: Fetch the inventory items via service layer
        const itemsResult = await binderService.getBinderCards(
          result.binder._id,
          {}, // No filters
          { limit: 10000, sortBy: 'default' }
        );
        const inventoryItems = itemsResult.success ? itemsResult.data.cards : [];
        
        // Step 3: Call the paginator with ALL the required data
        const { content, components } = paginateBinderCards(result.binder, inventoryItems, discordId, slug, page);
        
        // Step 4: Return an UPDATE_MESSAGE response to edit the original message
        return NextResponse.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: { content, components },
        });
      } catch (error) {
        // Return a visible error if the pagination fails
        return createErrorResponse(`Error processing page: ${error.message}`, true);
      }
    }
    // --- END OF FIX ---

    return createErrorResponse('Unknown interaction');
    
  } catch (error) {
    return createErrorResponse(`Error processing interaction: ${error.message || error}`);
  }
}
// //app/discord-v2/route.js
// import { NextRequest, NextResponse } from 'next/server';
// import { InteractionType, InteractionResponseType } from 'discord-interactions';
// import { verifyDiscordSignature } from './utils.js';
// import { createErrorResponse, createSuccessResponse, createComponentResponse, createUpdateResponse, createSelectMenu } from './responses.js';
// import { handleListBinders, handleSearchCommand, handleBinderCommand, handleTradeAnalysis, handleWantsCommand } from './commands.js';
// import { showCardPrintings } from './utils.js';

// // Import the new context menu handlers
// import { 
//   handlePublicBinder,
//   handlePublicWants,
//   handlePublicBinderSelect,
//   handlePublicBinderPage,
//   handlePublicWantsPage
// } from './commands.js';

// export async function POST(req) {
//   // Extract Discord headers
//   const signature = req.headers.get('x-signature-ed25519');
//   const timestamp = req.headers.get('x-signature-timestamp');
//   const publicKey = process.env.DISCORD_PUBLIC_KEY;

//   // Validate required headers
//   if (!signature || !timestamp || !publicKey) {
//     return new NextResponse('Missing required Discord headers', { status: 400 });
//   }

//   // Get raw body for signature verification
//   const rawBody = await req.text();

//   // Verify Discord signature
//   const isVerified = verifyDiscordSignature(signature, timestamp, rawBody, publicKey);
//   if (!isVerified) {
//     return new NextResponse('Invalid request signature', { status: 401 });
//   }

//   // Parse the request body
//   let body;
//   try {
//     body = JSON.parse(rawBody);
//   } catch (error) {
//     return createErrorResponse('Invalid JSON body');
//   }

//   // Handle Discord ping verification
//   if (body.type === InteractionType.PING) {
//     return NextResponse.json({ type: InteractionResponseType.PONG });
//   }

//   // Handle slash commands
//   if (body.type === InteractionType.APPLICATION_COMMAND) {
//     return handleApplicationCommand(body);
//   }

//   // Handle component interactions (buttons, select menus, etc.)
//   if (body.type === InteractionType.MESSAGE_COMPONENT) {
//     return handleMessageComponent(body);
//   }

//   // Unknown interaction type
//   return new NextResponse('Unhandled interaction type', { status: 400 });
// }

// /**
//  * Route slash commands to appropriate handlers
//  */
// async function handleApplicationCommand(body) {
//   const { name, options, type, target_id } = body.data;

//   try {
//     // Handle slash commands (type 1)
//     if (type === 1 || !type) { // type defaults to 1 for slash commands
//       switch (name) {
//         case 'search':
//           return await handleSearchCommand(body, options);

//         case 'binder':
//           return await handleBinderCommand(body, options);

//         case 'wants':
//           return await handleWantsCommand(body, options);

//         case 'trade':
//           return await handleTradeAnalysis(body, options);

//         default:
//           return createErrorResponse(`Command not implemented yet: ${name}`);
//       }
//     }

//     // Handle user context menu commands (type 2)
//     if (type === 2) {
//       const targetDiscordId = target_id;
      
//       switch (name) {
//         case 'Show Binder':
//           try {
//             const result = await handlePublicBinder(targetDiscordId, body);
//             return result;
//           } catch (error) {
//             return createErrorResponse(`Public binder error: ${error.message}`, false);
//           }

//         case 'Show Wants List':
//           try {
//             const result = await handlePublicWants(targetDiscordId, body);
//             return result;
//           } catch (error) {
//             return createErrorResponse(`Public wants error: ${error.message}`, false);
//           }

//         default:
//           return createErrorResponse(`Context menu command not implemented: ${name}`);
//       }
//     }

//     // Handle message context menu commands (type 3) - if needed in future
//     if (type === 3) {
//       return createErrorResponse('Message context menu commands not supported yet');
//     }

//     return createErrorResponse('Unknown command type');

//   } catch (error) {
//     return createErrorResponse(`Error processing command: ${error.message || error}`);
//   }
// }

// /**
//  * Handle component interactions (select menus, buttons)
//  */
// async function handleMessageComponent(body) {
//   const customId = body.data.custom_id;
//   const [action, ...rest] = customId.split(':');

//   try {
//     // Handle public component interactions first
//     if (action === 'public_binder_select') {
//       try {
//         const result = await handlePublicBinderSelect(customId, body);
//         return result;
//       } catch (error) {
//         return createErrorResponse(`Public binder select error: ${error.message}`, false);
//       }
//     }

//     if (action === 'public_binder_page') {
//       try {
//         const result = await handlePublicBinderPage(customId, body);
//         return result;
//       } catch (error) {
//         return createErrorResponse(`Public binder page error: ${error.message}`, false);
//       }
//     }

//     if (action === 'public_wants_page') {
//       try {
//         const result = await handlePublicWantsPage(customId, body);
//         return result;
//       } catch (error) {
//         return createErrorResponse(`Public wants page error: ${error.message}`, false);
//       }
//     }

//     // Handle existing private component interactions
//     if (action === 'search_card_select') {
//       const [_, originalSearchTerm] = customId.split(':');
//       const selectedCardUniqueId = body.data.values[0];
      
//       // Get the card name from the selected option's label
//       const selectedOption = body.data.resolved?.messages?.[0]?.components?.[0]?.components?.[0]?.options?.find(
//         opt => opt.value === selectedCardUniqueId
//       );
//       const cardName = selectedOption?.label?.split(' -')[0] || originalSearchTerm;
      
//       // Show all printings for the selected card
//       const result = await showCardPrintings(selectedCardUniqueId, cardName);
//       if (result.error) {
//         return createErrorResponse(result.error, true);
//       }
      
//       return NextResponse.json({
//         type: InteractionResponseType.UPDATE_MESSAGE,
//         data: {
//           content: result.content,
//           components: result.components || [], // Include action buttons if available
//           flags: 64 // ephemeral
//         },
//       });
//     }

//     // Handle "Add to Binder" button clicks
//     if (action === 'add_to_binder') {
//       const [_, cardUniqueId, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
      
//       const { handleAddToBinder } = await import('./commands.js');
//       return await handleAddToBinder(body, cardUniqueId, cardName);
//     }

//     // Handle "Add to Wants" button clicks
//     if (action === 'add_to_wants') {
//       const [_, cardUniqueId, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
      
//       const { handleAddToWants } = await import('./commands.js');
//       return await handleAddToWants(body, cardUniqueId, cardName);
//     }

//     // Handle "Who Has" button clicks
//     if (action === 'who_has') {
//       const [_, cardUniqueId, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
      
//       const { handleWhoHas } = await import('./commands.js');
//       return await handleWhoHas(body, cardUniqueId, cardName);
//     }

//     // Handle binder selection for adding cards
//     if (action === 'select_binder_for_add') {
//       const [_, cardUniqueId, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
//       const selectedBinder = body.data.values[0];
      
//       const { handleBinderSelection } = await import('./commands.js');
//       return await handleBinderSelection(body, cardUniqueId, cardName, selectedBinder);
//     }

//     // Handle printing selection for adding to wants
//     if (action === 'select_printing_for_wants') {
//       const [_, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
//       const selectedPrintingId = body.data.values[0];
//       const userId = body.member?.user?.id || body.user?.id;
      
//       const { addPrintingToWants } = await import('./commands.js');
//       return await addPrintingToWants(userId, selectedPrintingId, cardName);
//     }

//     // Handle printing selection for adding to binder
//     if (action === 'select_printing_for_add') {
//       const [_, binderSlug, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
//       const selectedPrintingId = body.data.values[0];
//       const userId = body.member?.user?.id || body.user?.id;
      
//       const { addPrintingToBinder } = await import('./commands.js');
//       return await addPrintingToBinder(userId, binderSlug, selectedPrintingId, cardName);
//     }

//     // Handle wants list pagination
//     if (action === 'wants_page') {
//       const [_, discordId, userId, pageStr] = customId.split(':');
//       const page = parseInt(pageStr || '0', 10);
      
//       try {
//         // Import required modules - NOTE THE .ts EXTENSION
//         const { paginateWantsListCards } = await import('./utils/paginateWantsCards.ts');
//         const { connectToDatabase } = await import('@/lib/mongodb');
//         const User = (await import('@/models/User')).default;
//         const WantsList = (await import('@/models/WantsList')).default;
        
//         // Connect to database
//         await connectToDatabase();
        
//         // Get user and wants list
//         const user = await User.findOne({ discordId });
//         if (!user) {
//           return createErrorResponse('User not found.', true);
//         }
        
//         const wantsList = await WantsList.findOne({ userId: user._id.toString() });
//         if (!wantsList) {
//           return createErrorResponse('Wants list not found.', true);
//         }
        
//         // Generate paginated content
//         const username = user.username || user.discordUsername || 'User';
//         const { content, components } = paginateWantsListCards(wantsList, discordId, username, page);
        
//         // Return updated message
//         return NextResponse.json({
//           type: InteractionResponseType.UPDATE_MESSAGE,
//           data: { content, components },
//         });
        
//       } catch (error) {
//         return createErrorResponse(`Error loading page: ${error.message}`, true);
//       }
//     }

//     // Handle printing selection for whohas
//     if (action === 'select_printing_for_whohas') {
//       const [_, encodedCardName] = customId.split(':');
//       const cardName = decodeURIComponent(encodedCardName);
//       const selectedPrintingId = body.data.values[0];
      
//       const { showWhoHasPrinting } = await import('./commands.js');
//       return await showWhoHasPrinting(selectedPrintingId, cardName);
//     }

//     // Handle binder selection dropdown interactions
//     if (action === 'binder_select') {
//       const [_, targetDiscordId] = customId.split(':');
//       const selectedSlug = body.data.values[0];
      
//       try {
//         // Import and use the specific binder handler
//         const { handleSpecificBinder } = await import('./commands/binder.js');
//         const result = await handleSpecificBinder(targetDiscordId, selectedSlug);
        
//         // Extract the response data properly
//         let responseData;
//         if (result instanceof NextResponse) {
//           // Parse NextResponse to get the data
//           const resultBody = await result.text();
//           const parsed = JSON.parse(resultBody);
//           responseData = parsed.data;
//         } else {
//           responseData = result.data || result;
//         }
        
//         // Update the original interaction with the binder content
//         return NextResponse.json({
//           type: InteractionResponseType.UPDATE_MESSAGE,
//           data: {
//             content: responseData?.content || "Loading binder...",
//             components: responseData?.components || [],
//             flags: 64 // EPHEMERAL
//           }
//         });
        
//       } catch (error) {
//         return NextResponse.json({
//           type: InteractionResponseType.UPDATE_MESSAGE,
//           data: {
//             content: `Error loading binder: ${error.message}`,
//             components: [],
//             flags: 64 // EPHEMERAL
//           }
//         });
//       }
//     }

//     if (action === 'binder_page') {
//       const [_, discordId, slug, pageStr] = customId.split(':');
//       const page = parseInt(pageStr || '0', 10);
      
//       // Import the pagination function
//       const { paginateBinderCards } = await import('./utils/paginateBinderCards.ts');
//       const { fetchBinderByDiscord } = await import('./utils.js');
      
//       const result = await fetchBinderByDiscord(discordId, slug);
//       if (result.error) {
//         return createErrorResponse(result.error);
//       }
      
//       const { content, components } = paginateBinderCards(result.binder, discordId, slug, page);
      
//       return NextResponse.json({
//         type: InteractionResponseType.UPDATE_MESSAGE,
//         data: { content, components },
//       });
//     }

//     return createErrorResponse('Unknown interaction');
    
//   } catch (error) {
//     return createErrorResponse(`Error processing interaction: ${error.message || error}`);
//   }
// }