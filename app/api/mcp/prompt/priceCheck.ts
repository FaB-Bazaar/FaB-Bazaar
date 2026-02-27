// File: app/api/mcp/prompt/priceCheck.ts
export const priceCheckPrompt = {
    name: "price_check",
    description: "💰 Check current market prices for cards",
    arguments: [
      {
        name: "card_name", 
        description: "Card name to check prices for",
        required: true
      },
      {
        name: "max_price",
        description: "Maximum price filter",
        required: false
      },
      {
        name: "compare_editions",
        description: "Whether to compare different editions/foilings",
        required: false
      }
    ],
    
    handler: (args: any = {}) => {
      const cardName = args.card_name;
      const maxPrice = args.max_price;
      const compareEditions = args.compare_editions;
      
      if (!cardName) {
        throw new Error("card_name is required for price check");
      }
      
      return {
        description: `Check current market prices for ${cardName}`,
        messages: [
          {
            role: "user", 
            content: {
              type: "text",
              text: `I want to check current market prices for "${cardName}" in Flesh and Blood.
  
  ${maxPrice ? `I'm specifically looking for copies under $${maxPrice}.` : 'I want to see all available printings and their current prices.'}
  ${compareEditions ? 'Please help me compare prices across different editions and foilings.' : ''}
  
  Please help me:
  1. Search for all available printings of this card
  2. Show current market prices (TCG Market, Mid, Low where available)
  3. Include different editions (Alpha, First Edition, Unlimited) if they exist
  4. Show different foiling options (Rainbow Foil, Cold Foil, Standard)
  5. Organize results by price for easy comparison
  
  Use the FabBazaar MCP server to get me the most current pricing data.`
            }
          }
        ]
      };
    }
  };