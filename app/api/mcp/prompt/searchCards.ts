// File: app/api/mcp/prompt/searchCards.ts
export const searchCardsPrompt = {
    name: "search_cards", 
    description: "🔍 Search for Flesh and Blood cards with filters",
    arguments: [
      {
        name: "card_name",
        description: "Name of the card to search for",
        required: false
      },
      {
        name: "set_code",
        description: "Set code (e.g., wtr, arc, mon)", 
        required: false
      },
      {
        name: "foiling",
        description: "Foiling type (r=Rainbow, c=Cold, s=Standard, g=Gold)",
        required: false
      },
      {
        name: "max_price",
        description: "Maximum price in USD",
        required: false
      }
    ],
    
    handler: (args: any = {}) => {
      const cardName = args.card_name || '';
      const setCode = args.set_code || '';
      const foiling = args.foiling || '';
      const maxPrice = args.max_price || '';
      
      let searchCriteria = [];
      if (cardName) searchCriteria.push(`Card name: "${cardName}"`);
      if (setCode) searchCriteria.push(`Set: "${setCode}"`);
      if (foiling) searchCriteria.push(`Foiling: "${foiling}"`);
      if (maxPrice) searchCriteria.push(`Maximum price: $${maxPrice}`);
      
      const criteriaText = searchCriteria.length > 0 
        ? searchCriteria.join('\n') 
        : 'I will specify my search criteria';
      
      return {
        description: `Search for Flesh and Blood cards${cardName ? ` - ${cardName}` : ''}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text", 
              text: `I want to search for Flesh and Blood cards using the FabBazaar MCP server.
  
  My search criteria:
  ${criteriaText}
  
  Please help me:
  1. Complete any required setup steps if I haven't already
  2. Search for cards matching my criteria
  3. Show me the results with pricing and availability information
  4. Explain the different editions and foilings available
  
  I'd like to see the results organized clearly with prices and key details.`
            }
          }
        ]
      };
    }
  };