// app/discord-v2/utils/paginateDeckList.ts

/**
 * Format a single deck for display in Discord
 */
function formatDeck(deck: any): string {
  const name = deck.name || 'Unnamed Deck';
  const format = deck.format || 'Unknown Format';
  const hero = deck.heroName ? ` • ${deck.heroName}` : '';
  const cards = deck.totalCards != null ? ` • ${deck.totalCards} cards` : '';
  const publicId = deck.publicId || deck._id;
  const deckUrl = `${process.env.NEXT_PUBLIC_APP_URL}/decks/${publicId}`;
  const privacy = deck.isPublic ? '' : ' 🔒';

  return `[**${name}**${privacy}](${deckUrl}) - ${format}${hero}${cards}`;
}

/**
 * Paginate a user's deck list with Discord components
 * @param {Array} decks - Array of deck summary objects
 * @param {string} discordId - Discord user ID of the requester (for button IDs)
 * @param {string} targetDiscordId - Discord user ID whose decks are being shown
 * @param {string} username - Username for display
 * @param {number} page - Current page (0-indexed)
 * @returns {Object} - { content, components }
 */
export function paginateDeckList(
  decks: any[],
  discordId: string,
  targetDiscordId: string,
  username: string,
  page = 0
) {
  const pageSize = 8; // 8 decks per page to stay under Discord's 2000 char limit
  const totalPages = Math.ceil(decks.length / pageSize);
  const startIndex = page * pageSize;
  const paginatedDecks = decks.slice(startIndex, startIndex + pageSize);

  const deckList = paginatedDecks.map(formatDeck).join('\n') || 'No decks found.';

  const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL}/decks`;
  const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
  const content = `**${username}'s Decks**${pageInfo}\nTotal: ${decks.length} deck${decks.length !== 1 ? 's' : ''}\n\n${deckList}`;

  const components: any[] = [];

  // Select menu — lets user view a deck's contents directly
  if (paginatedDecks.length > 0) {
    components.push({
      type: 1, // Action Row
      components: [
        {
          type: 3, // String select menu
          custom_id: `deck_select:${discordId}`,
          placeholder: 'Select a deck to view its cards',
          min_values: 1,
          max_values: 1,
          options: paginatedDecks.map((deck: any) => {
            const hero = deck.heroName ? ` • ${deck.heroName}` : '';
            const cards = deck.totalCards != null ? ` • ${deck.totalCards} cards` : '';
            return {
              label: (deck.name || 'Unnamed Deck').slice(0, 100),
              description: `${deck.format || 'Unknown'}${hero}${cards}`.slice(0, 100),
              value: deck.publicId || deck._id,
            };
          }),
        },
      ],
    });
  }

  // Pagination buttons (only shown when there's more than one page)
  if (totalPages > 1) {
    const hasPrev = page > 0;
    const hasNext = page + 1 < totalPages;

    components.push({
      type: 1, // Action Row
      components: [
        {
          type: 2,
          label: 'Previous',
          style: 2,
          custom_id: `deck_page:${discordId}:${targetDiscordId}:${page - 1}`,
          disabled: !hasPrev,
        },
        {
          type: 2,
          label: `${page + 1}/${totalPages}`,
          style: 2,
          custom_id: `deck_page_indicator_${Date.now()}`,
          disabled: true,
        },
        {
          type: 2,
          label: 'Next',
          style: 1,
          custom_id: `deck_page:${discordId}:${targetDiscordId}:${page + 1}`,
          disabled: !hasNext,
        },
      ],
    });
  }

  return { content, components };
}
