// app/api/mcp/tool/updateWants.ts - MCP tool for updating wants list
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const updateWantsTool = {
    name: 'update_wants',
    description: `📝 WANTS LIST MANAGEMENT TOOL (Works independently)
  
  Update your wants list with selected printings, quantities, and priorities using secure API endpoint.
  
  🔥 FEATURES:
  • Batch printing mode (add multiple cards at once)
  • Priority settings (high, medium, low) with medium as default  
  • Quantity support for playsets
  • Notes support for additional context
  • Two-step preview/confirm process
  
  💡 Note: This tool works independently but gets MUCH better results when you use the resource-dependent search tools to find cards first.
  
  📝 OPERATION MODE:
  
  🎯 **Batch Printing Mode**:
     Add multiple printings in one operation
     - Use: printings parameter  
     - Format: [{ printingId, quantity?, priority?, notes? }]
     - Default priority: "medium" if not specified
     - Default quantity: 1 if not specified
  
  🔄 **Two-Step Process:**
     1. mode: "preview" - Show what will be added
     2. mode: "confirm" - Actually execute the operation
  
  🔐 **Authentication Options:**
     • Automatic session detection (web users)
     • Discord ID authentication
     • MCP token authentication
     • Manual auth params via authParams object
  
  📚 **Recommended Workflow:**
     Step 1-2: read_mandatory_constants_first (both URIs) [optional but improves search]
     Step 3: search_printings (find your cards) [optional]
     Step 4: extract_printing_ids (get selection interface) [optional]
     Step 5: update_wants (add to wants list)
  
  ✅ This tool works without setup, but setup improves card selection accuracy!
  
  📖 **Examples:**
     • Batch: printings: [
         { printingId: "WTR001", quantity: 1, priority: "high" },
         { printingId: "ARC002", quantity: 3, priority: "medium" },
         { printingId: "MON003", quantity: 1, notes: "For Oldhim deck" }
       ]`,
    
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['preview', 'confirm'],
          default: 'preview',
          description: 'preview: Show what will be added, confirm: Actually add to wants list'
        },
        
        // Batch printing mode (primary mode)
        printings: {
          type: 'array',
          description: 'Batch printing mode - add multiple printings at once',
          items: {
            type: 'object',
            properties: {
              printingId: {
                type: 'string',
                description: 'The printing ID to add to wants list'
              },
              quantity: {
                type: 'number',
                default: 1,
                description: 'Quantity wanted (default: 1)'
              },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                default: 'medium',
                description: 'Priority level (default: medium)'
              },
              notes: {
                type: 'string',
                default: '',
                description: 'Additional notes about why you want this card'
              }
            },
            required: ['printingId']
          }
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
      required: ['printings']
    },
  
    async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
      // Use the MCP-specific API base URL helper
      const API_BASE_URL = getMcpApiBaseUrl();
      const endpoint = `${API_BASE_URL}/api/wants/add`;
      
      try {
        const {
          mode = 'preview',
          printings,
          authParams = {}
        } = params;
  
        // Validate input
        if (!printings || !Array.isArray(printings) || printings.length === 0) {
          return {
            success: false,
            error: 'Must provide printings array with at least one item'
          };
        }
  
        // Validate each printing
        for (const printing of printings) {
          if (!printing.printingId) {
            return {
              success: false,
              error: 'Each printing must have a printingId'
            };
          }
        }
  
        // Get the token for authentication
        const tokenToUse = authenticatedUser?.mcpToken || mcpToken || authParams.mcpToken;

        // Build query parameters for Discord ID if needed
        const queryParams = new URLSearchParams();
        if (authParams.discordId) {
          queryParams.append('discordId', authParams.discordId);
          console.log(`[UpdateWants] Using Discord ID: ${authParams.discordId}`);
        }

        // Prepare headers with Authorization
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (tokenToUse) {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
          console.log(`[UpdateWants] Added Authorization header with MCP token`);
        } else if (!authParams.discordId) {
          console.warn('[UpdateWants] No authentication method available');
        }

        // Build the URL with query parameters (only for Discord ID)
        const urlWithParams = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
        
        // Calculate summary info
        const totalCards = printings.reduce((sum, p) => sum + (p.quantity || 1), 0);
        const priorityCounts = printings.reduce((counts: any, p) => {
          const priority = p.priority || 'medium';
          counts[priority] = (counts[priority] || 0) + 1;
          return counts;
        }, {});
        
        const previewMessage = `Adding ${printings.length} printings (${totalCards} total cards) to wants list`;
        const priorityBreakdown = Object.entries(priorityCounts)
          .map(([priority, count]) => `${count} ${priority}`)
          .join(', ');
        
        // Preview mode - don't make the API call
        if (mode === 'preview') {
          return {
            success: true,
            mode: 'preview',
            operation: 'batch_wants',
            message: `Preview: ${previewMessage}`,
            printings: printings.map(p => ({
              printingId: p.printingId,
              quantity: p.quantity || 1,
              priority: p.priority || 'medium',
              notes: p.notes || ''
            })),
            summary: {
              total_printings: printings.length,
              total_cards: totalCards,
              priority_breakdown: priorityBreakdown
            },
            next_step: "Call again with mode='confirm' to execute"
          };
        }
        
        // Confirm mode - make the actual API call
        console.log(`[UpdateWants] Making API call to add cards to wants list`);
        console.log(`[UpdateWants] Full URL: ${urlWithParams}`);
        
        // Prepare request body (using the batch format from your wants API)
        const requestBody = {
          printings: printings.map(p => ({
            printingId: p.printingId,
            quantity: p.quantity || 1,
            priority: p.priority || 'medium',
            notes: p.notes || ''
          }))
        };
        
        console.log(`[UpdateWants] Request body:`, JSON.stringify(requestBody, null, 2));
        
        const response = await mcpFetch(urlWithParams, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[UpdateWants] HTTP ${response.status}:`, errorText);
          
          return {
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            status: response.status,
            debug: {
              url: urlWithParams,
              headers: Object.keys(headers),
              authenticatedUser: authenticatedUser ? `${authenticatedUser.username} (${authenticatedUser.email})` : 'None',
              tokenProvided: !!tokenToUse
            }
          };
        }
        
        const result = await response.json();
        console.log('[UpdateWants] API Response:', result);
        
        if (!result.success) {
          return {
            success: false,
            error: result.error || 'API returned success: false',
            details: result
          };
        }
        
        // Success! Format the response
        const baseResponse = {
          success: true,
          mode: 'confirm',
          operation: 'batch_wants',
          authMethod: result.authMethod,
          authenticatedUser: result.authenticatedUser
        };
        
        // Add operation-specific details
        if (result.summary) {
          // Batch operation response
          return {
            ...baseResponse,
            summary: result.summary,
            message: `✅ Successfully processed ${result.summary.total} cards: ${result.summary.added} added, ${result.summary.updated} updated via ${result.authMethod} authentication`,
            details: result.results,
            priority_breakdown: priorityBreakdown
          };
        } else {
          // Fallback for single operation response
          return {
            ...baseResponse,
            message: `✅ Successfully added cards to wants list via ${result.authMethod} authentication`
          };
        }
        
      } catch (error) {
        console.error('[UpdateWants] Fetch error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Network or parsing error',
          type: 'fetch_error'
        };
      }
    }
  };
  
  export default updateWantsTool;