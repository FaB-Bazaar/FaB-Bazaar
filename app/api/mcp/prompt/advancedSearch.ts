// File: app/api/mcp/prompt/advancedSearch.ts
export const advancedSearchPrompt = {
    name: "advanced_search",
    description: "🔧 Advanced card searching with multiple filters",
    arguments: [
      {
        name: "class_type",
        description: "Hero class (guardian, warrior, ninja, etc.)",
        required: false
      },
      {
        name: "card_type", 
        description: "Card type (action, attack, equipment, etc.)",
        required: false
      },
      {
        name: "keywords",
        description: "Keywords like 'go again', 'dominate', 'combo'",
        required: false
      },
      {
        name: "format",
        description: "Format legality (blitz, cc, commoner)",
        required: false
      }
    ],
    
    handler: (args: any = {}) => {
      const filters = Object.entries(args)
        .filter(([key, value]) => value)
        .map(([key, value]) => `${key.replace('_', ' ')}: ${value}`)
        .join('\n');
      
      return {
        description: "Advanced search with multiple filters",
        messages: [
          {
            role: "user",
            content: {
              type: "text", 
              text: `I want to do an advanced search for Flesh and Blood cards using multiple filters.
  
  ${filters ? `My search filters:\n${filters}` : 'I will specify my advanced search criteria.'}
  
  Please help me:
  1. Complete any required setup for the FabBazaar MCP server
  2. Set up a comprehensive search with multiple filters
  3. Show me cards that match all my criteria
  4. Include pricing and availability information
  5. Explain any interesting findings or patterns in the results
  
  I'm looking for cards that fit specific deck-building or collection goals.`
            }
          }
        ]
      };
    }
  };
  
  // File: app/api/mcp/prompt/index.ts - Central registry
  import { setupGuidePrompt } from './setupGuide';
  import { searchCardsPrompt } from './searchCards'; 
  import { manageCollectionPrompt } from './manageCollection';
  import { priceCheckPrompt } from './priceCheck';
  import { advancedSearchPrompt } from './advancedSearch';
  
  export const mcpPrompts = [
    setupGuidePrompt,
    searchCardsPrompt,
    manageCollectionPrompt, 
    priceCheckPrompt,
    advancedSearchPrompt
  ];
  
  export const getPromptByName = (name: string) => {
    return mcpPrompts.find(prompt => prompt.name === name);
  };