// app/api/mcp/tool/whoHas.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { displayUsername } from '@/lib/utils/display-username';

export const whoHasTool = {
  name: 'who_has',
  description: `🔍 FIND CARD OWNERS: Discover who owns specific cards in their collections
  
  🎯 FEATURES:
  • Find users who own specific printing IDs
  • Search all versions of a card (use cardUniqueIds parameter)
  • Filter by cards available for trade
  • Get owner details and card quantities
  • View total values and conditions
  
  📚 WORKFLOW:
  search_printings (returns printing_id + card_unique_id) → who_has (find owners)

  👤 OWNER NAMES: when talking to the user, refer to owners by display_username
  (internal dc_/gh_ prefixes stripped); the raw username field is for profile
  URLs (/profile/<username>) and follow-up tool calls.

  📋 KEY DISTINCTION:
  • printingIds   — specific printing (one set/edition/foiling combo). Use printing_id from search_printings.
  • cardUniqueIds — ANY version of the card (all sets/editions/foilings). Use card_unique_id from search_printings.
  For "does anyone own X?" always use cardUniqueIds — it finds owners across all versions.

  📋 **CALL FORMAT — any version (most common):**
  { "cardUniqueIds": "kMRjHHLzPtgLw7j7PmQqf", "limit": 20 }

  📋 **CALL FORMAT — specific printing:**
  { "printingIds": "cLHGKMCjPb89zwNPmMFBp", "limit": 20 }

  📋 **CALL FORMAT — multiple cards, for trade only:**
  { "cardUniqueIds": "kMRjHHLzPtgLw7j7PmQqf,QDrWjRHBmBWBnJHmmbzRM", "forTradeOnly": true }

  📋 **CALL FORMAT — minimum condition:**
  { "cardUniqueIds": "kMRjHHLzPtgLw7j7PmQqf", "minCondition": "LP" }`,
  
  parameters: {
    type: 'object',
    properties: {
      printingIds: {
        type: 'string',
        description: 'Comma-separated list of specific printing IDs to search for. Example: "GtjztF7LT8kPDQ8w7GkRw,cLHGKMCjPb89zwNPmMFBp"'
      },
      cardUniqueIds: {
        type: 'string',
        description: 'Comma-separated list of card unique IDs to search for ANY version. Example: "mwBrbdjPn7h8nPpCNzpMR,kMRjHHLzPtgLw7j7PmQqf"'
      },
      forTradeOnly: {
        type: 'boolean',
        default: false,
        description: 'If true, only shows cards that owners have marked as available for trade.'
      },
      minCondition: {
        type: 'string',
        enum: ['NM', 'LP', 'MP', 'HP', 'DMG'],
        description: 'Minimum condition requirement (NM=best, DMG=worst)'
      },
      page: {
        type: 'number',
        default: 1,
        minimum: 1,
        description: 'Page number for pagination'
      },
      limit: {
        type: 'number',
        default: 50,
        minimum: 1,
        maximum: 100,
        description: 'Number of owners per page (1-100)'
      },
      _resourcesConfirmed: {
        type: 'boolean',
        description: 'INTERNAL: Confirms required setup resources have been loaded. Do not set manually.'
      }
    },
    // Note: exactly one of printingIds or cardUniqueIds is required (enforced in handler)
    required: []
  },

  handler: async (toolInput: any, authenticatedUser?: any, token?: string) => {

    try {
      // Build query parameters for the whohas endpoint
      const queryParams = new URLSearchParams();
      
      // Required parameter - exactly one of these
      if (toolInput.printingIds) {
        queryParams.set('printingIds', toolInput.printingIds);
      } else if (toolInput.cardUniqueIds) {
        queryParams.set('cardUniqueIds', toolInput.cardUniqueIds);
      } else {
        throw new Error('Must provide either printingIds or cardUniqueIds');
      }
      
      // Optional parameters
      if (toolInput.forTradeOnly) {
        queryParams.set('forTradeOnly', 'true');
      }
      if (toolInput.minCondition) {
        queryParams.set('minCondition', toolInput.minCondition);
      }
      if (toolInput.page && toolInput.page > 1) {
        queryParams.set('page', toolInput.page.toString());
      }
      if (toolInput.limit && toolInput.limit !== 50) {
        queryParams.set('limit', toolInput.limit.toString());
      }

      // Build the full URL for the internal API call
      const baseUrl = getMcpApiBaseUrl();
      const whohasUrl = `${baseUrl}/api/whohas?${queryParams.toString()}`;
      
      // Prepare headers for authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'FabBazaar-MCP-WhoHas/1.0'
      };

      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }

      // Make the API call
      const response = await mcpFetch(whohasUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhoHas API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`WhoHas API error: ${data.error || 'Unknown error'}`);
      }

      // Handle no results
      if (!data.owners || data.owners.length === 0) {
        const searchType = toolInput.printingIds ? 'specific printings' : 'any versions of these cards';
        const suggestion = toolInput.printingIds ? 'Try using cardUniqueIds instead to find any version of the cards.' : '';
        
        return {
          message: `No users found with ${searchType}. ${suggestion}`,
          summary: data.summary,
          metadata: data.metadata,
          searchMode: data.search_mode,
          totalOwners: 0,
          totalCards: 0,
          owners: []
        };
      }

      // Format the response for optimal display using actual field names
      const ownerSummaries = data.owners.map((owner: any) => {
        const binderSummaries = owner.binders.map((binder: any) => {
          const cardDetails = binder.matching_cards.map((card: any) => {
            // Use actual field names from your data structure
            const foilingDisplay = card.foiling === 'c' ? 'CF' : card.foiling === 'r' ? 'RF' : 'NF';
            const setDisplay = card.set?.toUpperCase() || 'Unknown';
            const priceDisplay = card.tcg_low || 'N/A';
            
            return `    - ${card.total_quantity}x ${card.display_name} (${setDisplay}) ${foilingDisplay} ($${priceDisplay} each)`;
          }).join('\n');
          
          return `  📁 ${binder.binder_name}: ${binder.total_cards_found}x cards ($${binder.total_value})\n${cardDetails}`;
        }).join('\n');
        
        return `• ${displayUsername(owner.username)} - ${owner.total_cards_found}x total across ${owner.binders.length} binder(s)\n${binderSummaries}\n  💰 Total value: $${owner.total_value}`;
      });

      // Structured data keeps the raw username (profile URLs and follow-up
      // tool calls need it) and adds the prefix-stripped display name.
      const ownersWithDisplay = data.owners.map((owner: any) => ({
        ...owner,
        display_username: displayUsername(owner.username),
      }));

      const summaryText = `Found ${data.summary.total_owners_found} owners with ${data.summary.total_cards_found} total cards across ${data.summary.unique_printings_found} unique printings:

${ownerSummaries.join('\n\n')}

📊 Search mode: ${data.search_mode || 'specific_printings'}
📈 Totals: ${data.summary.total_owners_found} owners | ${data.summary.total_cards_found} cards | $${data.summary.total_value_found || 0} value
📄 Page ${data.metadata.current_page}/${data.metadata.total_pages}`;

      return {
        message: summaryText,
        summary: data.summary,
        metadata: data.metadata,
        searchMode: data.search_mode,
        totalOwners: data.summary.total_owners_found,
        totalCards: data.summary.total_cards_found,
        totalValue: data.summary.total_value_found,
        owners: ownersWithDisplay
      };

    } catch (error) {
      console.error('💥 Error in who_has tool:', error);
      throw new Error(`Who Has search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};
