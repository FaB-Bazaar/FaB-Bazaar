// File: app/api/mcp/prompt/manageCollection.ts
export const manageCollectionPrompt = {
    name: "manage_collection",
    description: "📋 Add cards to your binder collection", 
    arguments: [
      {
        name: "search_criteria",
        description: "Description of cards to search for before adding",
        required: true
      },
      {
        name: "quantities",
        description: "Expected quantities or preferences",
        required: false
      }
    ],
    
    handler: (args: any = {}) => {
      const searchCriteria = args.search_criteria || 'specific cards I want to add';
      const quantities = args.quantities || '';
      
      return {
        description: "Add cards to your FabBazaar collection binder",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I want to manage my Flesh and Blood card collection using the FabBazaar MCP server.
  
  I'm looking for: ${searchCriteria}
  ${quantities ? `Quantity preferences: ${quantities}` : ''}
  
  Please help me with this complete workflow:
  1. Search for the cards I want
  2. Review the available printings with prices
  3. Get a selection interface to choose specific editions/foilings
  4. Add my chosen cards with quantities to my collection binder
  
  Walk me through each step, including any setup requirements I might need to complete first.`
            }
          }
        ]
      };
    }
  };
  