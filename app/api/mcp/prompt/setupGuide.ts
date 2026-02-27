// File: app/api/mcp/prompt/setupGuide.ts
export const setupGuidePrompt = {
    name: "setup_guide",
    description: "🚨 ESSENTIAL FIRST STEPS - Complete MCP setup for card searching",
    arguments: [],
    
    handler: () => {
      return {
        description: "Essential setup steps for FabBazaar MCP card searching",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I'm new to the FabBazaar MCP server and want to search for Flesh and Blood cards. Can you guide me through the setup process and show me how to search effectively?
  
  I understand there are some required setup steps I need to complete first before I can search for cards. Please walk me through this step by step.
  
  My goal is to be able to search for cards, check prices, and potentially add cards to my collection.
  
  Please start by explaining what I need to do and then help me execute each step.`
            }
          }
        ]
      };
    }
  };