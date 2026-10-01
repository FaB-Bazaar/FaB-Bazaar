// app/api/mcp/prompt/index.ts - FabBazaar MCP Slash Commands
export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  handler: (args: any) => {
    description: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: {
        type: 'text';
        text: string;
      };
    }>;
  };
}

export const mcpPrompts: MCPPrompt[] = [
  {
    name: 'find',
    description: 'Find printings for specific cards by name - /find {card names}',
    arguments: [
      {
        name: 'cards',
        description: 'Card names to search for (comma-separated or space-separated)',
        required: true
      },
      {
        name: 'set',
        description: 'Optional: Specific set to search in (e.g., wtr, arc, mon)',
        required: false
      },
      {
        name: 'foiling',
        description: 'Optional: Foiling type (r=Rainbow, c=Cold, s=Standard, g=Gold)',
        required: false
      }
    ],
    handler: (args) => {
      const cards = args.cards || '';
      const set = args.set ? `, focusing on set "${args.set}"` : '';
      const foiling = args.foiling ? `, with foiling "${args.foiling}"` : '';
      
      return {
        description: `Search for specific Flesh and Blood cards: ${cards}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need to find printings for these Flesh and Blood cards: ${cards}${set}${foiling}

Please follow this exact workflow:
1. First run: read_mandatory_constants_first({"uri": "fab://constants"})
2. Then run: read_mandatory_constants_first({"uri": "searchable://card/fields"})  
3. Finally, search for each card using: search_printings with proper filters and "_resourcesConfirmed": true

Show me the results in a clear format with pricing, set info, and availability.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'build-deck',
    description: 'Research the meta and card pool, agree a plan with you, then build a deck - /build-deck {hero}',
    arguments: [
      {
        name: 'hero',
        description: 'Hero name (e.g. "dorinthea ironsong", or "dorinthea" for the young hero)',
        required: true
      },
      {
        name: 'format',
        description: 'Optional: Classic Constructed, Blitz, Silver Age, Living Legend or Commoner',
        required: false
      },
      {
        name: 'budget',
        description: 'Optional: Budget constraint (e.g. "under $100", "no limit")',
        required: false
      }
    ],
    handler: (args) => {
      const hero = args.hero || '';
      const format = args.format || '';
      const budget = args.budget ? ` My budget: ${args.budget}.` : '';

      return {
        description: `Build a Flesh and Blood deck for ${hero}${format ? ` (${format})` : ''}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help me build a Flesh and Blood deck for ${hero}${format ? ` in ${format}` : ''}.${budget}

Work from data, not memory. Only name, propose or add cards a tool returned in this session. If you remember a card that might fit, search for it and read its text before mentioning it.

1. Call get_deckbuilding_guide({ "format": "${format || '<ask me the format first>'}", "heroName": "${hero}" }) and follow its method.
2. Research before suggesting anything:
   - get_decks_to_beat with format and heroName: which cards do recent lists share, and where do they disagree?
   - search_printings with filters.heroLegal and filters.format, by card type and by facetTags, reading the card text.
   - If I'm signed in, compare_collection_to_decks_to_beat to see which recent lists I could build from my cards.
3. Report what you found: the core cards, the flex slots, and 2-3 possible game plans, each backed by the tool results above.
4. Stop and ask me which plan I want, my budget, cards I want to use, and the matchups I expect.
5. Only after I answer: create_deck, add_cards_to_deck, then get_deck({ "includeText": true }) and run the guide's self-check. For each card, say which deck list or search it came from.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'price-check',
    description: 'Check current prices for specific cards - /price-check {card names}',
    arguments: [
      {
        name: 'cards',
        description: 'Card names to check prices for',
        required: true
      },
      {
        name: 'condition',
        description: 'Optional: Card condition preference',
        required: false
      }
    ],
    handler: (args) => {
      const cards = args.cards || '';
      const condition = args.condition ? ` in ${args.condition} condition` : '';
      
      return {
        description: `Check current market prices for: ${cards}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need current price information for these Flesh and Blood cards: ${cards}${condition}

Please:
1. Complete the setup first:
   - read_mandatory_constants_first({"uri": "fab://constants"})
   - read_mandatory_constants_first({"uri": "searchable://card/fields"})

2. Search for each card with search_printings using "_resourcesConfirmed": true
3. Show me:
   - Current TCG Player prices (low, mid, market)
   - Different printings and their price variations
   - Foiling options and their price differences
   - Set variations and their relative values

Format the results clearly with price comparisons across different versions.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'add-to-binder',
    description: 'Add specific cards to your collection binder - /add-to-binder {card selections}',
    arguments: [
      {
        name: 'cards',
        description: 'Cards to add to binder (can be names or IDs from previous searches)',
        required: true
      },
      {
        name: 'quantities',
        description: 'Optional: Quantities for each card (comma-separated)',
        required: false
      }
    ],
    handler: (args) => {
      const cards = args.cards || '';
      const quantities = args.quantities ? ` with quantities: ${args.quantities}` : '';
      
      return {
        description: `Add cards to your FabBazaar collection binder`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to add these cards to my collection binder: ${cards}${quantities}

Please help me:
1. If I provided card names (not IDs), call search_printings to find the exact printings and grab each printing_id.
2. Then use add_to_binder to add the cards to my collection.
3. Confirm what was added and show my updated collection status.

If I provided specific printing IDs, you can skip directly to add_to_binder.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'meta-analysis',
    description: 'Analyze the current meta and find relevant cards - /meta-analysis {format/strategy}',
    arguments: [
      {
        name: 'focus',
        description: 'Meta focus (e.g., "current blitz meta", "anti-aggro cards", "top tier heroes")',
        required: true
      },
      {
        name: 'budget',
        description: 'Optional: Budget consideration',
        required: false
      }
    ],
    handler: (args) => {
      const focus = args.focus || '';
      const budget = args.budget ? ` within ${args.budget} budget` : '';
      
      return {
        description: `Analyze the Flesh and Blood meta: ${focus}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to analyze the Flesh and Blood meta focusing on: ${focus}${budget}

Please help me by:
1. First completing the mandatory setup:
   - read_mandatory_constants_first({"uri": "fab://constants"})
   - read_mandatory_constants_first({"uri": "searchable://card/fields"})

2. Then searching for relevant cards using search_printings with "_resourcesConfirmed": true:
   - Key meta cards and their variants
   - Counter-play options and tech cards
   - Budget alternatives for expensive staples
   - Emerging strategies and their key pieces

3. Provide analysis including:
   - Current price trends for meta-relevant cards
   - Deck archetype breakdowns
   - Recommended pickups and potential specs
   - Format-specific considerations

Focus on actionable insights for competitive play and collection building.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'collection-stats',
    description: 'View your collection statistics and valuable cards - /collection-stats',
    arguments: [],
    handler: (args) => {
      return {
        description: 'View your FabBazaar collection statistics and highlights',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please show me my collection statistics and valuable cards.

Use the update_binder tool with a "stats" or "summary" action to:
1. Display my total collection size
2. Show my most valuable cards
3. Highlight recent additions
4. Provide collection value estimates
5. Suggest gaps in my collection for competitive play

Format the results in an easy-to-read summary with key insights about my collection's strengths and areas for improvement.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'set-explorer',
    description: 'Explore cards from a specific set - /set-explorer {set name}',
    arguments: [
      {
        name: 'set',
        description: 'Set code or name (e.g., wtr, arc, mon, "Welcome to Rathe")',
        required: true
      },
      {
        name: 'rarity',
        description: 'Optional: Focus on specific rarity (m=Majestic, l=Legendary, r=Rare, etc.)',
        required: false
      }
    ],
    handler: (args) => {
      const set = args.set || '';
      const rarity = args.rarity ? ` focusing on ${args.rarity} rarity cards` : '';
      
      return {
        description: `Explore cards from set: ${set}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to explore cards from the set: ${set}${rarity}

Please:
1. Complete the mandatory setup first:
   - read_mandatory_constants_first({"uri": "fab://constants"})
   - read_mandatory_constants_first({"uri": "searchable://card/fields"})

2. Use search_printings with "_resourcesConfirmed": true to find cards from this set
3. Show me:
   - Notable cards and their prices
   - Key cards for competitive play
   - Investment opportunities
   - Complete rarity breakdown
   - Available foiling options

Organize the results by rarity and include competitive playability assessments.`
            }
          }
        ]
      };
    }
  },

  {
    name: 'quick-search',
    description: 'Quick search with common filters - /quick-search {terms}',
    arguments: [
      {
        name: 'query',
        description: 'Search terms (can include card names, text, or types)',
        required: true
      },
      {
        name: 'limit',
        description: 'Optional: Number of results to show (default: 12)',
        required: false
      }
    ],
    handler: (args) => {
      const query = args.query || '';
      const limit = args.limit ? parseInt(args.limit) : 12;
      
      return {
        description: `Quick search for: ${query}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Perform a quick search for: ${query}

Please:
1. Complete the setup (if not already done this session):
   - read_mandatory_constants_first({"uri": "fab://constants"})
   - read_mandatory_constants_first({"uri": "searchable://card/fields"})

2. Use search_printings with "_resourcesConfirmed": true to search for cards matching the query
3. Limit results to ${limit} entries
4. Show summary information with prices

This is for quick reference, so keep results concise but informative.`
            }
          }
        ]
      };
    }
  }
];

// Helper function to get prompt by name
export function getPromptByName(name: string): MCPPrompt | undefined {
  return mcpPrompts.find(prompt => prompt.name === name);
}

// Export for use in your route handler
export { mcpPrompts as default };