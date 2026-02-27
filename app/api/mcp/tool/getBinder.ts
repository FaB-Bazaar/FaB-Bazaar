// app/api/mcp/tool/getBinder.ts - Updated with LLM instructions
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const getBinderTool = {
  name: 'get_binder',
  description: `📋 VIEW BINDER CONTENTS (Works independently)

  Retrieve the contents of ANY of your binders with pagination, search, and filtering support.
  This tool works independently and doesn't require the search setup steps.

  💡 TIP: Use list_binders first to see all your binders and their slugs!

  🖥️ DISPLAY INSTRUCTIONS (IMPORTANT):
  Always present card results as a markdown table with these columns:
    Qty | Foil | Name | Edition | Card ID | Condition | For Trade | Price

  Example:
  | Qty | Foil | Name                  | Edition | Card ID | Cond | Trade | Price  |
  |-----|------|-----------------------|---------|---------|------|-------|--------|
  | 3   | RF   | Channel Lake Frigid   | 1st     | ELE146  | NM   | ✅    | $12.50 |
  | 1   | CF   | Heart of Ice          | 1st     | ELE144  | NM   | ❌    | $8.00  |
  | 2   | NF   | Blizzard              | UNL     | ELE012  | NM   | ✅    | $1.20  |

  - Omit "Edition" cell content when edition is normal/blank
  - Use ✅/❌ for For Trade column
  - Show price as $X.XX (use tcg_low), show — if no price
  - Omit Condition column if all cards are NM
  - Always show totals row: total unique entries and total card count

  📖 EXAMPLES OF "arguments" OBJECT:
  • View specific binder: { "binderSlug": "main-collection" }
  • View MCP binder: { "binderSlug": "mcp-binder" }
  • Paginated: { "binderSlug": "main-collection", "page": 2, "limit": 50 }
  • Search within binder: { "binderSlug": "main-collection", "search": "command" }

  🔄 WORKFLOW:
  Step 1: list_binders (see all available binders)
  Step 2: get_binder with specific slug (view that binder's contents)`,
  
  parameters: {
    type: 'object',
    properties: {
      binderSlug: {
        type: 'string',
        default: 'mcp-binder',
        description: 'The binder slug to retrieve (e.g., "main-collection", "mcp-binder"). Use list_binders to see all available slugs. Defaults to "mcp-binder" if not specified.'
      },
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
      showDetails: {
        type: 'boolean',
        default: true,
        description: 'Include detailed card information in response'
      },
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
    required: ['binderSlug']
  },

  // NO CHANGES ARE NEEDED TO THE HANDLER LOGIC. IT IS CORRECT.
  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    
    try {
      const {
        binderSlug = 'mcp-binder',
        page = 1,
        limit = 100,
        search = '',
        showDetails = true,
        authParams = {}
      } = params;

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken || authParams.mcpToken;
      
      if (!tokenToUse) {
        return {
          success: false,
          error: 'Authentication failed: No MCP token was found for the user.'
        };
      }

      // --- STEP 1: Get binder metadata and _id ---
      console.log(`[GetBinder] Step 1: Fetching binder list for slug: ${binderSlug}`);
      const bindersUrl = `${API_BASE_URL}/api/binders?summary=true`;

      const bindersResponse = await mcpFetch(bindersUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        }
      });

      // ✅ ADDED LOGGING: See the actual status code from the API
      console.log(`[GetBinder] Step 1 Response Status: ${bindersResponse.status}`);

      if (!bindersResponse.ok) {
        const errorText = await bindersResponse.text();
        console.error(`[GetBinder] Step 1 API call failed with status ${bindersResponse.status}:`, errorText);
        return {
          success: false,
          error: `Failed to fetch binder list (HTTP ${bindersResponse.status}). Please check if your token is valid.`
        };
      }

      const bindersResult = await bindersResponse.json();
      
      if (!bindersResult.success) {
        console.error('[GetBinder] Step 1 API returned success:false.', bindersResult);
        return {
          success: false,
          error: bindersResult.error || 'The API returned an error while fetching the binder list.'
        };
      }

      const targetBinder = bindersResult.binders?.find((binder: any) => binder.slug === binderSlug);
      
      if (!targetBinder) {
        // ✅ ADDED LOGGING: Show what binders WERE available
        const availableSlugs = bindersResult.binders?.map((b: any) => b.slug).join(', ') || 'None';
        console.warn(`[GetBinder] Binder with slug "${binderSlug}" not found. Available binders: [${availableSlugs}]`);
        return {
          success: false,
          error: `Binder with slug "${binderSlug}" not found for this user. Available binders: ${availableSlugs}.`
        };
      }

      const binderId = targetBinder._id;
      console.log(`[GetBinder] Step 1 Success: Found binder "${binderSlug}" with ID: ${binderId}`);

      // --- STEP 2: Get binder cards using the _id ---
      const cardsUrl = `${API_BASE_URL}/api/binders/${binderId}/cards`;
      const cardsParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search,
        sortBy: 'default'
      });
      const fullCardsUrl = `${cardsUrl}?${cardsParams.toString()}`;

      console.log(`[GetBinder] Step 2: Fetching cards from: ${fullCardsUrl}`);

      const cardsResponse = await mcpFetch(fullCardsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        }
      });
      console.log(`[GetBinder] Step 2 Response Status: ${cardsResponse.status}`);

      if (!cardsResponse.ok) {
        const errorText = await cardsResponse.text();
        console.error(`[GetBinder] Step 2 API call failed with status ${cardsResponse.status}:`, errorText);
        return {
          success: false,
          error: `Failed to fetch cards for binder (HTTP ${cardsResponse.status}).`
        };
      }

      const cardsResult = await cardsResponse.json();
      
      if (!cardsResult.success) {
        console.error('[GetBinder] Step 2 API returned success:false.', cardsResult);
        return {
          success: false,
          error: cardsResult.error || 'The API returned an error while fetching cards.'
        };
      }

      console.log(`[GetBinder] Step 2 Success: Retrieved ${cardsResult.cards?.length || 0} cards.`);

      // --- ✅ IMPROVED: Format the final success response ---
      const { pagination, cards } = cardsResult;
      
      let detailedMessage = `✅ Successfully retrieved binder '${targetBinder.name}'.\n`;
      detailedMessage += `Showing ${cards.length} of ${pagination.totalCards} total cards (Page ${pagination.page}/${pagination.totalPages}).`;
      
      if (search) {
        detailedMessage += `\nFiltered by search term: "${search}".`;
      }
      
      if (showDetails && cards && cards.length > 0) {
        detailedMessage += `\n\n📋 Cards on this page:\n`;
        cards.forEach((card: any) => {
          // Format: 3x NF Channel Lake Frigid 1st ELE146
          const qty = card.quantity;
          const name = card.display_name || card.name;
          const foilingMap: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
          const foiling = foilingMap[card.foiling?.toLowerCase()] ?? card.foiling ?? '';
          const editionMap: Record<string, string> = { f: '1st', a: 'A', u: 'UNL', n: '' };
          const edition = editionMap[card.edition?.toLowerCase()] ?? card.edition ?? '';
          const collectorNum = card.collector_number || '';
          const setCode = (card.set || '').toUpperCase();
          const cardId = collectorNum ? `${setCode}${collectorNum}` : '';

          const parts = [`${qty}x`];
          if (foiling) parts.push(foiling);
          parts.push(name);
          if (edition) parts.push(edition);
          if (cardId) parts.push(cardId);
          if (card.condition && card.condition !== 'NM') parts.push(`[${card.condition}]`);

          detailedMessage += `\n- ${parts.join(' ')}`;
        });
      }

      return {
        success: true,
        message: detailedMessage,
        binder: cardsResult.binder,
        pagination: pagination,
        cards: cards,
      };
      
    } catch (error) {
      console.error('[GetBinder] A critical fetch error occurred in the handler:', error);
      return {
        success: false,
        error: `A network or parsing error occurred: ${error instanceof Error ? error.message : 'Unknown error'}.`
      };
    }
  }
};

export default getBinderTool;