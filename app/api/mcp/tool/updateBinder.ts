// app/api/mcp/tool/updateBinder.ts - Fixed to use same pattern as getBinder
import { NextRequest, NextResponse } from 'next/server';
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const updateBinderTool = {
  name: 'update_binder',
  description: `📝 BINDER MANAGEMENT TOOL (Works independently)

Update the MCP binder with selected printings and quantities using secure API endpoint. Now supports two operation modes:

🔥 FEATURES:
- Batch printing mode (add single or multiple cards at once)
- Selection interface mode (existing functionality)
- Automatic binder ID resolution from slug

💡 Note: This tool works independently but gets MUCH better results when you use the resource-dependent search tools to find cards first.

📝 OPERATION MODES:

1️⃣ **Batch Printing Mode** (Recommended):
   Add one or more printings in a single operation
   - Use: printings parameter (array)
   - Format: [{ printingId, quantity, condition?, forTrade?, notes? }]
   - Works for single cards too: [{ printingId: "89gRLdpT7fWp9FQCRLHnp", quantity: 1 }]
   - More efficient for all operations
   - Note: printingId is a unique hex string from search results, not a collector number

2️⃣ **Selection Interface Mode**:
   Add cards selected from extract_printing_ids interface
   - Use: selectionList + userSelection parameters
   - Format: "2a,1b,3d" style selections

🔐 **Authentication Options:**
   • Automatic session detection (web users)
   • Discord ID authentication
   • MCP token authentication
   • Manual auth params via authParams object

📚 **Recommended Workflow:**
   Step 1-2: read_mandatory_constants_first (both URIs) [optional but improves search]
   Step 3: search_printings (find your cards) [optional]
   Step 4: extract_printing_ids (get selection interface) [for selection mode]
   Step 5: update_binder (add to collection)

✅ This tool works without setup, but setup improves card selection accuracy!

📖 **Examples:**
   • Single card: printings: [{ printingId: "89gRLdpT7fWp9FQCRLHnp", quantity: 2, condition: "LP" }]
   • Multiple cards: printings: [{ printingId: "89gRLdpT7fWp9FQCRLHnp", quantity: 1 }, { printingId: "7kXmN2pQ9rTv8GHdSKJwx", quantity: 3 }]
   • Selection: userSelection: "2a,1b,3d", selectionList: [...]

⚠️ **Important:** printingId is a unique hex string (like "89gRLdpT7fWp9FQCRLHnp"), NOT the collector number (WTR001).
   Use search_printings or extract_printing_ids tools to get valid printingId values.`,
  
  parameters: {
    type: 'object',
    properties: {
      binderSlug: {
        type: 'string',
        default: 'mcp-binder',
        description: 'The binder slug/ID to update - defaults to "mcp-binder"'
      },

      // Batch printing mode (primary mode)
      printings: {
        type: 'array',
        description: 'Add one or more printings (works for single cards too)',
        items: {
          type: 'object',
          properties: {
            printingId: {
              type: 'string',
              description: 'The unique printing ID (hex string like "89gRLdpT7fWp9FQCRLHnp") from search results, NOT collector number'
            },
            quantity: {
              type: 'number',
              default: 1,
              description: 'Quantity to add'
            },
            condition: {
              type: 'string',
              enum: ['NM', 'LP', 'MP', 'HP', 'DMG'],
              default: 'NM',
              description: 'Card condition'
            },
            forTrade: {
              type: 'boolean',
              default: true,
              description: 'Whether card is available for trade'
            },
            notes: {
              type: 'string',
              default: '',
              description: 'Additional notes about the card'
            }
          },
          required: ['printingId']
        }
      },
      
      // Selection interface mode
      selectionList: {
        type: 'array',
        description: 'The selection list from extract_printing_ids with letter mappings',
        items: {
          type: 'object',
          properties: {
            cardId: { type: 'string' },
            details: { type: 'string' },
            letter: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'string' },
            printingId: { type: 'string' }
          }
        }
      },
      
      userSelection: {
        type: 'string',
        description: 'User selection in format like "2a,1b,3d" where number is quantity and letter is the option'
      },
      
      // Authentication parameters (optional)
      authParams: {
        type: 'object',
        description: 'Optional authentication parameters (if not using session)',
        properties: {
          discordId: {
            type: 'string',
            description: 'Discord user ID for authentication'
          },
          mcpToken: {
            type: 'string', 
            description: 'MCP authentication token'
          }
        }
      }
    },
    // Note: either printings (batch mode) or userSelection+selectionList (selection mode) is required (enforced in handler)
    required: []
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    
    try {
      const {
        binderSlug = 'mcp-binder',
        printings,
        selectionList,
        userSelection,
        authParams = {}
      } = params;

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken || authParams.mcpToken;
      
      if (!tokenToUse) {
        return {
          success: false,
          error: 'Authentication failed: No MCP token was found for the user.',
          step: 'authentication'
        };
      }

      // STEP 1: Get the user's binders list to find the actual _id (same as getBinder)
      const bindersUrl = `${API_BASE_URL}/api/binders?summary=true`;

      const bindersResponse = await mcpFetch(bindersUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        }
      });


      if (!bindersResponse.ok) {
        const errorText = await bindersResponse.text();
        console.error(`[UpdateBinder] Step 1 API call failed with status ${bindersResponse.status}:`, errorText);
        return {
          success: false,
          error: `Failed to fetch binder list (HTTP ${bindersResponse.status}). Please check if your token is valid.`,
          step: 'get_binders'
        };
      }

      const bindersResult = await bindersResponse.json();
      
      if (!bindersResult.success) {
        console.error('[UpdateBinder] Step 1 API returned success:false.', bindersResult);
        return {
          success: false,
          error: bindersResult.error || 'The API returned an error while fetching the binder list.',
          step: 'get_binders'
        };
      }

      const targetBinder = bindersResult.binders?.find((binder: any) => binder.slug === binderSlug);
      
      if (!targetBinder) {
        const availableSlugs = bindersResult.binders?.map((b: any) => b.slug).join(', ') || 'None';
        console.warn(`[UpdateBinder] Binder with slug "${binderSlug}" not found. Available binders: [${availableSlugs}]`);
        return {
          success: false,
          error: `Binder with slug "${binderSlug}" not found for this user. Available binders: ${availableSlugs}.`,
          step: 'find_binder'
        };
      }

      const actualBinderId = targetBinder._id;

      // STEP 2: Prepare request body based on operation mode
      let requestBody: any = {};
      let operationType = '';

      if (selectionList && userSelection) {
        // Selection interface mode
        operationType = 'selection';
        const selections = parseUserSelection(userSelection, selectionList);
        requestBody.printings = selections.map(sel => ({
          printingId: sel.printingId,
          quantity: sel.quantity,
          condition: 'NM',
          forTrade: true,
          notes: ''
        }));
      } else if (printings && Array.isArray(printings)) {
        // Batch printing mode (works for single or multiple cards)
        operationType = 'batch';
        requestBody.printings = printings.map(p => ({
          printingId: p.printingId,
          quantity: p.quantity || 1,
          condition: p.condition || 'NM',
          forTrade: p.forTrade !== undefined ? p.forTrade : true,
          notes: p.notes || ''
        }));
      } else {
        return {
          success: false,
          error: 'Must provide either printings array or selectionList+userSelection',
          step: 'validate_input'
        };
      }
      
      // STEP 3: Make the cards API call using the actual MongoDB ObjectId
      const cardsEndpoint = `${API_BASE_URL}/api/binders/${actualBinderId}/cards`;

      const response = await mcpFetch(cardsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(requestBody),
      });
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[UpdateBinder] HTTP ${response.status}:`, errorText);
        
        return {
          success: false,
          error: `Failed to add cards to binder (HTTP ${response.status}): ${errorText}`,
          status: response.status,
          step: 'add_cards',
          debug: {
            url: cardsEndpoint,
            actualBinderId,
            operationType,
            authenticatedUser: authenticatedUser ? `${authenticatedUser.username} (${authenticatedUser.email})` : 'None',
            tokenProvided: !!tokenToUse
          }
        };
      }
      
      const result = await response.json();
      console.log('[UpdateBinder] Step 3 API Response:', result);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'API returned success: false',
          details: result,
          step: 'add_cards'
        };
      }
      
      // Success! Format the response
      const baseResponse = {
        success: true,
        operation: operationType,
        binderSlug,
        binderName: targetBinder.name,
        actualBinderId,
        authMethod: result.authMethod || 'mcpToken'
      };

      if (result.summary) {
        // Response with summary (batch operations)
        const cardCount = result.summary.total;
        const cardWord = cardCount === 1 ? 'card' : 'cards';
        return {
          ...baseResponse,
          summary: result.summary,
          message: `✅ Successfully processed ${cardCount} ${cardWord}: ${result.summary.added} added, ${result.summary.updated} updated to binder "${targetBinder.name}"`,
          details: result.results
        };
      } else {
        // Response without summary (legacy format)
        return {
          ...baseResponse,
          message: `✅ Successfully added cards to binder "${targetBinder.name}"`
        };
      }
      
    } catch (error) {
      console.error('[UpdateBinder] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network or parsing error',
        type: 'fetch_error',
        step: 'unknown'
      };
    }
  }
};

/**
 * Parse user selection string like "2a,1b,3d" with selection list
 */
function parseUserSelection(userSelection: string, selectionList: any[]) {
  const selections = [];
  const parts = userSelection.split(',').map(s => s.trim());
  
  for (const part of parts) {
    const match = part.match(/^(\d+)([a-z]+)$/i);
    if (!match) continue;
    
    const quantity = parseInt(match[1]);
    const letter = match[2].toLowerCase();
    
    const option = selectionList.find(item => 
      item.letter && item.letter.toLowerCase() === letter
    );
    
    if (option && option.printingId) {
      selections.push({
        quantity,
        letter,
        printingId: option.printingId,
        name: option.name,
        details: option.details
      });
    }
  }
  
  return selections;
}

export default updateBinderTool;