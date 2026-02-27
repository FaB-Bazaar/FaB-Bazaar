// app/api/mcp/tool/getWants.ts - MCP tool for retrieving wants list contents (OAuth + MCP Token support)
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const getWantsTool = {
  name: 'get_wants',
  description: `📋 WANTS LIST RETRIEVAL TOOL (MCP Token Authentication)

Retrieve the contents of a wants list with pagination, search, and filtering support.

🔍 FEATURES:
• Get wants list contents for authenticated user
• Pagination support for large wants lists
• Search filtering by card name
• Priority filtering (high, medium, low)
• Multiple authentication methods supported
• Detailed printing information (set, edition, foiling, rarity, price)

📚 USAGE:
• View wants list contents
• Search for specific cards in wants list
• Filter by priority level
• Export/analyze wants data
• Verify card additions after using update_wants

🔐 AUTHENTICATION (Multiple Methods Supported):
• MCP token (primary for MCP clients)
• Session authentication (web users)
• Discord ID parameter (discordId=123456)

📖 EXAMPLES:
• Basic: getWants({})
• Paginated: getWants({ page: 2, limit: 50 })
• Filtered: getWants({ search: "command", priority: "high" })

💡 Note: This tool works independently and doesn't require the search setup steps.`,

  parameters: {
    type: 'object',
    properties: {
      page: {
        type: 'number',
        default: 1,
        minimum: 1,
        description: 'Page number for pagination (starts at 1)'
      },
      limit: {
        type: 'number',
        default: 100,
        minimum: 1,
        maximum: 100,
        description: 'Number of cards per page (1-100, default 100)'
      },
      search: {
        type: 'string',
        description: 'Optional search filter to find cards by name'
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Optional priority filter (high, medium, low)'
      },
      authParams: {
        type: 'object',
        description: 'Optional authentication parameters (if not using OAuth/MCP token)',
        properties: {
          discordId: {
            type: 'string',
            description: 'Discord user ID for authentication'
          }
        }
      }
    },
    required: []
  },

  async handler(params: any, authenticatedUser?: any, tokenFromAuth?: string) {
    // Use the MCP-specific API base URL helper
    const API_BASE_URL = getMcpApiBaseUrl();

    const endpoint = `${API_BASE_URL}/api/wants/get`;
    
    console.log(`[GetWants] Environment: ${process.env.NODE_ENV}, Using API base: ${API_BASE_URL}`);
    
    try {
      const {
        page = 1,
        limit = 100,
        search,
        priority,
        authParams = {}
      } = params;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      
      if (search) {
        queryParams.append('search', search);
      }
      
      if (priority && ['high', 'medium', 'low'].includes(priority.toLowerCase())) {
        queryParams.append('priority', priority.toLowerCase());
      }
      
      // Add Discord ID if provided in authParams
      if (authParams.discordId) {
        queryParams.append('discordId', authParams.discordId);
        console.log(`[GetWants] Using Discord ID: ${authParams.discordId}`);
      }
      
      // Determine authentication method and setup
      let authMethod = 'none';
      let hasToken = false;

      // Check if we have a token (MCP tokens from this deployment)
      if (tokenFromAuth) {
        hasToken = true;
        authMethod = 'mcp_token';
        console.log(`[GetWants] Using MCP token: ${tokenFromAuth.substring(0, 20)}...`);
      } else if (authParams.discordId) {
        authMethod = 'discordId';
      }
      
      const url = `${endpoint}?${queryParams.toString()}`;
      
      console.log(`[GetWants] Fetching wants list (page ${page}, limit ${limit})`);
      console.log(`[GetWants] Authentication method: ${authMethod}`);
      console.log(`[GetWants] Full URL: ${url}`);
      if (search) console.log(`[GetWants] Search filter: "${search}"`);
      if (priority) console.log(`[GetWants] Priority filter: "${priority}"`);
      
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if we have a token
      if (hasToken && tokenFromAuth) {
        headers['Authorization'] = `Bearer ${tokenFromAuth}`;
        console.log(`[GetWants] Added Authorization Bearer header`);
      }
      
      // Validate authentication
      if (authMethod === 'none') {
        console.warn('[GetWants] No authentication method provided');
        return {
          success: false,
          error: 'Authentication required: provide MCP token or Discord ID',
          authMethod: 'none',
          availableAuthMethods: ['mcp_token', 'discordId']
        };
      }
      
      const response = await mcpFetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GetWants] HTTP ${response.status}:`, errorText);
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
          debug: {
            url,
            headers: Object.keys(headers),
            authenticatedUser: authenticatedUser ? `${authenticatedUser.username} (${authenticatedUser.email})` : 'Token User',
            authMethod,
            hasDiscordId: !!authParams.discordId,
            hasToken: hasToken
          }
        };
      }
      
      const result = await response.json();
      console.log(`[GetWants] Retrieved ${result.cards?.length || 0} cards from wants list`);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'API returned success: false',
          details: result
        };
      }
      
      // Format the response for better readability
      const { metadata, cards } = result;
      
      // Create detailed message with enhanced printing information
      let detailedMessage = '';
      
      if (search && priority) {
        detailedMessage = `Found ${cards?.length || 0} cards matching "${search}" with priority "${priority}" in wants list (page ${metadata.current_page}/${metadata.total_pages})`;
      } else if (search) {
        detailedMessage = `Found ${cards?.length || 0} cards matching "${search}" in wants list (page ${metadata.current_page}/${metadata.total_pages})`;
      } else if (priority) {
        detailedMessage = `Found ${cards?.length || 0} cards with priority "${priority}" in wants list (page ${metadata.current_page}/${metadata.total_pages})`;
      } else {
        detailedMessage = `Retrieved ${cards?.length || 0} cards from wants list (page ${metadata.current_page}/${metadata.total_pages}, ${metadata.total_cards} total)`;
      }
      
      if (cards && cards.length > 0) {
        detailedMessage += `\n\n📋 WANTS LIST DETAILS:\n\n`;
        
        cards.forEach((card: any, index: number) => {
          detailedMessage += `${index + 1}. **${card.display_name}**`;
          
          if (card.quantity > 1) {
            detailedMessage += ` (x${card.quantity})`;
          }
          
          // Enhanced printing information with card ID
          let printingInfo = [];
          if (card.card_id) printingInfo.push(card.card_id);
          if (card.set) printingInfo.push(card.set.toUpperCase());
          if (card.edition_name && card.edition_name !== 'Unknown') printingInfo.push(card.edition_name);
          if (card.foiling_name && card.foiling_name !== 'Unknown') printingInfo.push(card.foiling_name);
          if (card.rarity_name && card.rarity_name !== 'Unknown') printingInfo.push(card.rarity_name);
          
          if (printingInfo.length > 0) {
            detailedMessage += ` [${printingInfo.join('-')}]`;
          }
          
          // Enhanced price information with range
          if (card.tcg_market) {
            detailedMessage += ` - Market: ${card.tcg_market}`;
            if (card.tcg_low && card.tcg_high && card.tcg_low !== card.tcg_high) {
              detailedMessage += ` (Range: ${card.tcg_low}-${card.tcg_high})`;
            }
          } else if (card.tcg_low) {
            detailedMessage += ` - ${card.tcg_low}`;
          }
          
          detailedMessage += ` - Priority: ${card.priority.toUpperCase()}`;
          detailedMessage += `\n   🆔 Printing ID: ${card.printing_id}`;
          
          detailedMessage += `\n`;
        });
        
        // Calculate total estimated value
        let totalValue = 0;
        let itemsWithPrices = 0;
        cards.forEach((card: any) => {
          const price = card.tcg_market || card.tcg_low || 0;
          if (price > 0) {
            totalValue += price * (card.quantity || 1);
            itemsWithPrices++;
          }
        });
        
        if (itemsWithPrices > 0) {
          detailedMessage += `\n💰 **Total Estimated Value: ${totalValue.toFixed(2)}** (${itemsWithPrices}/${cards.length} cards with pricing)`;
        }
        
        detailedMessage += `\n\n📊 Wants list owned by: ${result.authenticatedUser}`;
        detailedMessage += `\n🔐 Authentication: ${authMethod === 'mcp_token' ? 'MCP Token' : result.authMethod}`;
        detailedMessage += `\n📁 List: ${metadata.wants_list_name}`;
      }
      
      return {
        success: true,
        authMethod,
        authenticatedUser: result.authenticatedUser,
        wantsList: {
          name: metadata.wants_list_name,
          totalCards: metadata.total_cards,
          totalUniqueCards: metadata.total_unique_printings
        },
        pagination: {
          currentPage: metadata.current_page,
          totalPages: metadata.total_pages,
          cardsPerPage: metadata.cards_per_page,
          cardsInPage: metadata.cards_in_page,
          hasNextPage: metadata.has_next_page,
          hasPreviousPage: metadata.has_previous_page
        },
        filters: {
          search: metadata.search_query,
          priority: metadata.priority_filter
        },
        cards: cards || [],
        message: detailedMessage,
        rawApiResponse: result
      };
      
    } catch (error) {
      console.error('[GetWants] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network or parsing error',
        type: 'fetch_error'
      };
    }
  }
};

export default getWantsTool;