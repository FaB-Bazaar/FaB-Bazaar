// app/api/mcp/tool/listBinders.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const listBindersTool = {
  name: 'list_binders',
  description: `📚 LIST ALL BINDERS: View all your card binders/collections

  Shows a summary of all binders in your account with key stats:
  - Binder name and slug (used for get_binder)
  - Total cards and cards available for trade
  - Privacy settings
  - Last updated date

  This tool works independently - no setup required.

  🖥️ DISPLAY INSTRUCTIONS (IMPORTANT):
  Always present results as a markdown table with these columns:
    # | Name | Slug | Cards | For Trade | Visibility | Last Updated

  Example:
  | # | Name             | Slug             | Cards | For Trade | Visibility | Updated     |
  |---|------------------|------------------|-------|-----------|------------|-------------|
  | 1 | Main Collection  | main-collection  | 156   | 89        | Public     | 2 days ago  |
  | 2 | MCP Binder       | mcp-binder       | 42    | 42        | Private    | 1 hour ago  |

  Then follow with a tip: "Use get_binder with a slug to view contents."

  💡 WORKFLOW:
  Step 1: list_binders (see what binders you have)
  Step 2: get_binder (view specific binder contents using the slug from step 1)`,

  parameters: {
    type: 'object',
    properties: {
      includeStats: {
        type: 'boolean',
        default: true,
        description: 'Include card counts and value statistics for each binder'
      }
    }
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const { includeStats = true } = params;

      const tokenToUse = authenticatedUser?.mcpToken || token;

      if (!tokenToUse) {
        return {
          success: false,
          error: 'Authentication failed: No token was found for the user.'
        };
      }

      // Fetch user's binders
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
        console.error(`[ListBinders] API call failed with status ${bindersResponse.status}:`, errorText);
        return {
          success: false,
          error: `Failed to fetch binders (HTTP ${bindersResponse.status}). Please check if your token is valid.`
        };
      }

      const bindersResult = await bindersResponse.json();

      if (!bindersResult.success) {
        console.error('[ListBinders] API returned success:false.', bindersResult);
        return {
          success: false,
          error: bindersResult.error || 'The API returned an error while fetching binders.'
        };
      }

      const binders = bindersResult.binders || [];

      if (binders.length === 0) {
        return {
          success: true,
          message: `📭 No binders found. Create your first binder to start organizing your collection!`,
          binders: []
        };
      }

      // Format binders into a readable message
      let message = `📚 **Your Binders** (${binders.length} total)\n\n`;

      binders.forEach((binder: any, index: number) => {
        const binderNum = index + 1;
        message += `${binderNum}. **"${binder.name}"** (slug: \`${binder.slug}\`)\n`;

        if (includeStats && binder.stats) {
          const totalCards = binder.stats.totalQuantity || 0;
          const forTradeCards = binder.stats.quantityForTrade || 0;
          const totalValue = binder.stats.totalValue?.tcg_market || 0;

          message += `   📊 ${totalCards} total cards, ${forTradeCards} for trade\n`;
          if (totalValue > 0) {
            message += `   💰 Total value: $${totalValue.toFixed(2)}\n`;
          }
        } else {
          message += `   📊 ${binder.totalCards || 0} cards\n`;
        }

        message += `   ${binder.isPublic ? '🌐 Public' : '🔒 Private'} binder\n`;

        if (binder.updatedAt) {
          const updatedDate = new Date(binder.updatedAt);
          const now = new Date();
          const diffMs = now.getTime() - updatedDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          let timeAgo = '';
          if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            timeAgo = diffHours === 0 ? 'just now' : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          } else if (diffDays === 1) {
            timeAgo = 'yesterday';
          } else if (diffDays < 30) {
            timeAgo = `${diffDays} days ago`;
          } else {
            const diffMonths = Math.floor(diffDays / 30);
            timeAgo = `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
          }

          message += `   🕒 Last updated: ${timeAgo}\n`;
        }

        message += '\n';
      });

      message += `\n💡 **Next step:** Use \`get_binder\` with one of the slugs above to view its contents.\n`;
      message += `   Example: get_binder({"binderSlug": "${binders[0].slug}"})`;

      return {
        success: true,
        message,
        binders: binders.map((b: any) => ({
          name: b.name,
          slug: b.slug,
          totalCards: b.stats?.totalQuantity || b.totalCards || 0,
          forTradeCards: b.stats?.quantityForTrade || 0,
          isPublic: b.isPublic,
          updatedAt: b.updatedAt
        }))
      };

    } catch (error) {
      console.error('[ListBinders] Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred'
      };
    }
  }
};
