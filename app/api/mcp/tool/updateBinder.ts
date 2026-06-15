// app/api/mcp/tool/updateBinder.ts - Fixed to use same pattern as getBinder
import { NextRequest, NextResponse } from 'next/server';
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const updateBinderTool = {
  name: 'add_to_binder',
  description: `📝 ADD CARDS TO A BINDER.

Add one or more printings to a binder in a single call. Resolves the binder by slug (default "mcp-binder").

⚠️ \`printingId\` is the 21-char nanoid from search_printings (e.g. "GnC8TwPjbFPDNrhDHFwQb") — NOT a collector number (e.g. "EVR014"). Each printingId identifies one specific printing (set × edition × foiling).

Workflow: search_printings → pick printing_id(s) → add_to_binder.

📋 CALL FORMAT — add one card:
{
  "binderSlug": "mcp-binder",
  "printings": [{ "printingId": "GnC8TwPjbFPDNrhDHFwQb", "quantity": 1, "condition": "NM", "forTrade": false }]
}

📋 CALL FORMAT — add multiple cards:
{
  "binderSlug": "mcp-binder",
  "printings": [
    { "printingId": "GnC8TwPjbFPDNrhDHFwQb", "quantity": 1 },
    { "printingId": "cLHGKMCjPb89zwNPmMFBp", "quantity": 2, "forTrade": true }
  ]
}`,
  
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
              default: false,
              description: 'Whether the card is listed for trade. Defaults to false — adding to a collection does NOT list it for trade. Only set true when the user explicitly says the cards are for trade.'
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
      
    },
    required: ['printings']
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    
    try {
      const {
        binderSlug = 'mcp-binder',
        printings,
      } = params;

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken;

      if (!tokenToUse) {
        return {
          success: false,
          error: 'Authentication required: no bearer token found.',
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

      // STEP 2: Prepare request body
      if (!printings || !Array.isArray(printings) || printings.length === 0) {
        return {
          success: false,
          error: 'printings array is required. Format: [{ printingId, quantity, condition?, forTrade?, notes? }]',
          step: 'validate_input'
        };
      }

      const operationType = 'batch';
      const requestBody: any = {
        printings: printings.map(p => ({
          printingId: p.printingId,
          quantity: p.quantity || 1,
          condition: p.condition || 'NM',
          forTrade: p.forTrade !== undefined ? p.forTrade : false,
          notes: p.notes || ''
        }))
      };
      
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

export default updateBinderTool;