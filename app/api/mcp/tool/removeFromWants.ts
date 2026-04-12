// app/api/mcp/tool/removeFromWants.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const removeFromWantsTool = {
  name: 'remove_from_wants',
  description: `🗑️ REMOVE CARDS FROM YOUR WANTS LIST (Your wants only)

Remove one or more cards from YOUR wants list by printing ID.
This tool operates exclusively on the authenticated user's own wants list —
identity is enforced server-side from your auth token.

🛑 ALWAYS confirm with the user before calling this tool.
   Show them exactly which cards will be removed and wait for explicit approval.
   Do NOT remove cards based on assumptions or indirect instructions.

📋 WORKFLOW:
  Step 1: get_wants (view your current wants list)
  Step 2: Confirm with user — show card names and quantities to be removed
  Step 3: remove_from_wants (pass printingIds to remove)

📖 PARAMETERS:
  • printings: array of { printingId, quantity?, removeAll? }
  • quantity: how many copies to remove (default: 1)
  • removeAll: set to true to remove all copies of that printing regardless of quantity

📖 EXAMPLES:
  • Remove 1 copy:    printings: [{ printingId: "abc123", quantity: 1 }]
  • Remove all:       printings: [{ printingId: "abc123", removeAll: true }]
  • Batch remove:     printings: [{ printingId: "abc123", removeAll: true }, { printingId: "xyz789", quantity: 2 }]`,

  parameters: {
    type: 'object',
    properties: {
      printings: {
        type: 'array',
        description: 'Array of printings to remove from wants list',
        items: {
          type: 'object',
          properties: {
            printingId: {
              type: 'string',
              description: 'The printing ID to remove from wants list'
            },
            quantity: {
              type: 'number',
              default: 1,
              description: 'Number of copies to remove (default: 1). Ignored if removeAll is true.'
            },
            removeAll: {
              type: 'boolean',
              default: false,
              description: 'Set to true to remove all copies of this printing from wants list'
            }
          },
          required: ['printingId']
        }
      }
    },
    required: ['printings']
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const { printings } = params;

      if (!Array.isArray(printings) || printings.length === 0) {
        return {
          success: false,
          error: 'printings must be a non-empty array'
        };
      }

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken;
      if (!tokenToUse) {
        return {
          success: false,
          error: 'Authentication required: no bearer token found.'
        };
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/wants/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ printings })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[RemoveFromWants] API failed (${response.status}):`, errorText);
        return {
          success: false,
          error: `Failed to remove from wants list (HTTP ${response.status}).`
        };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const total = printings.length;
      return {
        success: true,
        message: `✅ Successfully removed ${total} item${total !== 1 ? 's' : ''} from your wants list`
      };

    } catch (error) {
      console.error('[RemoveFromWants] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};

export default removeFromWantsTool;
