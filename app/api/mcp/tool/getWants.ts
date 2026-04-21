// app/api/mcp/tool/getWants.ts - MCP tool for retrieving wants list contents
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const getWantsTool = {
  name: 'get_wants',
  description: `📋 WANTS LIST RETRIEVAL TOOL

Retrieve the contents of your wants list with pagination, search, and filtering support.

🔍 FEATURES:
• Pagination support for large wants lists
• Search filtering by card name
• Priority filtering (high, medium, low)
• Detailed printing information (set, edition, foiling, rarity, price)

📋 **CALL FORMAT:**
{ }
{ "page": 2, "limit": 50 }
{ "search": "command", "priority": "high" }`,

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
      showDetails: {
        type: 'boolean',
        default: true,
        description:
          'When true (default) the text response contains a full markdown table of every want on the page (Qty / Foil / Name / Set / Rarity / Price / Priority), letting you answer follow-up questions without another call. Set to false ONLY when the user just wants to browse visually and you want to save context tokens. The interactive widget renders either way.'
      }
    },
    required: []
  },

  _meta: {
    ui: { resourceUri: 'ui://card-grid/viewer.html' },
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
        priority
      } = params;

      const tokenToUse = authenticatedUser?.mcpToken || tokenFromAuth;

      if (!tokenToUse) {
        return {
          success: false,
          error: 'Authentication required: no bearer token found.'
        };
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      if (search) queryParams.append('search', search);
      if (priority && ['high', 'medium', 'low'].includes(priority.toLowerCase())) {
        queryParams.append('priority', priority.toLowerCase());
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenToUse}`
      };
      
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
            authenticatedUser: authenticatedUser ? `${authenticatedUser.username} (${authenticatedUser.email})` : 'Token User'
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
        detailedMessage += `\n🔐 Authentication: OAuth Bearer`;
        detailedMessage += `\n📁 List: ${metadata.wants_list_name}`;
      }
      
      return {
        success: true,
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

type McpAppResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, any>;
  isError?: boolean;
};

const FOIL_LABELS: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
const RARITY_LABELS: Record<string, string> = {
  c: 'Common', r: 'Rare', s: 'Super Rare', m: 'Majestic',
  l: 'Legendary', f: 'Fabled', t: 'Token', b: 'Basic', v: 'Marvel', p: 'Promo',
};

function wFoil(v: any): string {
  if (!v) return '';
  return FOIL_LABELS[String(v).toLowerCase()] ?? String(v);
}
function wRarity(v: any): string {
  if (!v) return '';
  return RARITY_LABELS[String(v).toLowerCase()] ?? String(v);
}
function wPipe(s: string): string { return s.replace(/\|/g, '\\|'); }

function buildWantsTable(cards: any[]): string {
  const header = '| Qty | Foil | Name | Set | Rarity | Price | Priority |\n' +
                 '|----:|:----:|------|:---:|:------:|------:|:--------:|';
  const rows = cards.map((c) => {
    const qty = c.quantity ?? '';
    const foil = wFoil(c.foiling);
    const name = wPipe(String(c.display_name ?? c.name ?? ''));
    const set = String(c.set ?? '').toUpperCase();
    const rarity = wRarity(c.rarity);
    const priceRaw = c.tcg_market ?? c.tcg_low;
    const price = priceRaw == null ? '—' : `$${Number(priceRaw).toFixed(2)}`;
    const priority = c.priority ? String(c.priority).toUpperCase() : '';
    return `| ${qty} | ${foil} | ${name} | ${set} | ${rarity} | ${price} | ${priority} |`;
  });
  return [header, ...rows].join('\n');
}

export function shapeWantsForMcp(
  raw: any,
  opts: { showDetails?: boolean; limit?: number } = {}
): McpAppResult {
  if (!raw || raw.success === false) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error retrieving wants list: ${raw?.error ?? 'unknown error'}` }],
    };
  }

  const showDetails = opts.showDetails !== false;
  const listName = raw.wantsList?.name ?? 'Wants';
  const cards: any[] = Array.isArray(raw.cards) ? raw.cards : [];
  const count = cards.length;
  const total = raw.wantsList?.totalCards ?? count;
  const unique = raw.wantsList?.totalUniqueCards ?? count;
  const page = raw.pagination?.currentPage ?? 1;
  const totalPages = raw.pagination?.totalPages ?? 1;
  const limit = raw.pagination?.cardsPerPage ?? opts.limit ?? 100;

  const url = 'https://fabbazaar.app/wants';
  const subtitle = `${unique} unique · ${total} total cards`;

  const heading = `Wants '${listName}' — ${count} shown (page ${page} of ${totalPages})`;
  const parts = [heading, `View: ${url}`];
  if (showDetails && count > 0) parts.push('', buildWantsTable(cards));
  const text = parts.join('\n');

  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      title: `Wants · ${listName}`,
      subtitle,
      url,
      pagination: { page, totalPages, total, limit },
      filters: { priority: true, rarity: true, set: true },
      tool: { name: 'get_wants', baseArgs: { limit }, pageParam: 'page' },
      cards,
      wantsList: raw.wantsList,
    },
  };
}