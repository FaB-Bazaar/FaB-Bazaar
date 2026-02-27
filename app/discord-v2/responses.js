//discord-v2/responses.js
import { NextResponse } from 'next/server';
import { InteractionResponseType } from 'discord-interactions';

/**
 * Create a standard error response for Discord interactions
 * @param {string} message - Error message to display
 * @param {boolean} ephemeral - Whether the message should be ephemeral (default: false)
 * @returns {NextResponse} Discord interaction response
 */
export function createErrorResponse(message, ephemeral = false) {
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
      flags: ephemeral ? 64 : 0, // 64 = ephemeral flag
    },
  });
}

/**
 * Create a standard success response for Discord interactions
 * @param {string} message - Success message to display
 * @param {boolean} ephemeral - Whether the message should be ephemeral (default: false)
 * @param {boolean} suppressEmbeds - Whether to suppress link embeds (default: false)
 * @returns {NextResponse} Discord interaction response
 */
export function createSuccessResponse(message, ephemeral = false, suppressEmbeds = false) {
  let flags = 0;
  if (ephemeral) flags |= 64; // EPHEMERAL flag
  if (suppressEmbeds) flags |= 4; // SUPPRESS_EMBEDS flag

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
      flags,
    },
  });
}

/**
 * Create a response with content and components (buttons, select menus, etc.)
 * @param {string} content - Message content
 * @param {Array} components - Discord components (buttons, select menus)
 * @param {boolean} ephemeral - Whether the message should be ephemeral (default: false)
 * @param {boolean} suppressEmbeds - Whether to suppress link embeds (default: false)
 * @returns {NextResponse} Discord interaction response
 */
export function createComponentResponse(content, components = [], ephemeral = false, suppressEmbeds = false) {
  let flags = 0;
  if (ephemeral) flags |= 64; // EPHEMERAL flag
  if (suppressEmbeds) flags |= 4; // SUPPRESS_EMBEDS flag

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      components,
      flags,
    },
  });
}

/**
 * Create an update message response (for component interactions)
 * @param {string} content - Updated message content
 * @param {Array} components - Updated Discord components
 * @returns {NextResponse} Discord interaction response
 */
export function createUpdateResponse(content, components = []) {
  return NextResponse.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content,
      components,
    },
  });
}

/**
 * Create a deferred response (for long-running operations)
 * @param {boolean} ephemeral - Whether the eventual response should be ephemeral
 * @returns {NextResponse} Discord interaction response
 */
export function createDeferredResponse(ephemeral = false) {
  return NextResponse.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: ephemeral ? 64 : 0,
    },
  });
}

/**
 * Create a select menu component
 * @param {string} customId - Custom ID for the select menu
 * @param {string} placeholder - Placeholder text
 * @param {Array} options - Array of {label, value} objects
 * @param {number} minValues - Minimum values to select (default: 1)
 * @param {number} maxValues - Maximum values to select (default: 1)
 * @returns {Object} Discord select menu component
 */
export function createSelectMenu(customId, placeholder, options, minValues = 1, maxValues = 1) {
  return {
    type: 1, // Action row
    components: [
      {
        type: 3, // String select menu
        custom_id: customId,
        placeholder,
        min_values: minValues,
        max_values: maxValues,
        options: options.map(option => ({
          label: String(option.label).slice(0, 100), // Discord limit
          value: String(option.value),
        })),
      },
    ],
  };
}

/**
 * Create pagination buttons
 * @param {string} baseCustomId - Base custom ID (page number will be appended)
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {string} discordId - Discord user ID
 * @param {string} id - Additional ID parameter
 * @returns {Object} Discord button components
 */
export function createPaginationButtons(baseCustomId, currentPage, totalPages, discordId, id) {
  const buttons = [];

  // Previous button
  if (currentPage > 0) {
    buttons.push({
      type: 2, // Button
      style: 2, // Secondary
      label: 'Previous',
      custom_id: `${baseCustomId}:${discordId}:${id}:${currentPage - 1}`,
    });
  }

  // Page indicator (disabled button)
  buttons.push({
    type: 2, // Button
    style: 2, // Secondary
    label: `Page ${currentPage + 1}/${totalPages}`,
    custom_id: `page_indicator_${Date.now()}`, // Unique ID
    disabled: true,
  });

  // Next button
  if (currentPage < totalPages - 1) {
    buttons.push({
      type: 2, // Button
      style: 2, // Secondary
      label: 'Next',
      custom_id: `${baseCustomId}:${discordId}:${id}:${currentPage + 1}`,
    });
  }

  return {
    type: 1, // Action row
    components: buttons,
  };
}

/**
 * Handle common Discord response patterns with error catching
 * @param {Function} handler - Async function to execute
 * @param {string} errorContext - Context for error logging
 * @returns {NextResponse} Discord interaction response
 */
export async function handleWithErrorCatch(handler, errorContext) {
  try {
    return await handler();
  } catch (error) {
    console.error(`[Discord] Error in ${errorContext}:`, error);
    return createErrorResponse(`Error processing ${errorContext}: ${error.message || error}`);
  }
}