// app/api/mcp/tool/curation/createCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const createCuratedListTool = {
  name: 'create_curated_list',
  description: `✨ CREATE CURATED LIST: Create a new hero-scoped curated card list (curator/admin only)

Lists are always scoped to a specific hero. New lists start unpublished — use update_curated_list to publish when ready.

heroName must be the lowercase canonical name from fab://constants → heroes_by_format (e.g. "rhinar, reckless rampage").

Variant types (optional): "budget", "mid", "premium"
  Use parentId to link variants to a parent list.

Example workflow:
1. create_curated_list({ name: "Rhinar Core", heroName: "rhinar, reckless rampage", format: "Classic Constructed" })
2. search_printings to find card printing IDs
3. add_card_to_list (×N) to populate
4. update_curated_list({ id, isPublished: true }) to publish`,

  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'List name (e.g. "Rhinar Core Cards")'
      },
      heroName: {
        type: 'string',
        description: 'Lowercase canonical hero name from fab://constants (e.g. "rhinar, reckless rampage")'
      },
      format: {
        type: 'string',
        enum: ['Classic Constructed', 'Silver Age', 'Living Legend', 'Blitz', 'Limited', 'Commoner'],
        description: 'Game format. Defaults to "Classic Constructed" if omitted.'
      },
      description: {
        type: 'string',
        description: 'Optional description of the list purpose'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization'
      },
      variantType: {
        type: 'string',
        enum: ['budget', 'mid', 'premium'],
        description: 'Optional: pricing tier variant'
      },
      parentId: {
        type: 'string',
        description: 'Optional: ID of parent list (for budget/mid/premium variants)'
      },
      sortOrder: {
        type: 'number',
        description: 'Optional: display sort order (lower = first)'
      }
    },
    required: ['name', 'heroName']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      if (!params?.name) {
        return { success: false, error: 'Missing required parameter: name' };
      }
      if (!params?.heroName) {
        return { success: false, error: 'Missing required parameter: heroName (e.g. "rhinar, reckless rampage")' };
      }

      const body: Record<string, any> = {
        name: params.name,
        heroName: params.heroName,
        format: params.format ?? 'Classic Constructed',
      };
      if (params.description) body.description = params.description;
      if (params.tags) body.tags = params.tags;
      if (params.variantType) body.variantType = params.variantType;
      if (params.parentId) body.parentId = params.parentId;
      if (params.sortOrder !== undefined) body.sortOrder = params.sortOrder;

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(body)
      });

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to create list (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const list = result.data;

      const message = `✅ Created list: **${list.name}**\n`
        + `ID: \`${list.id}\`\n`
        + `Hero: ${list.heroName} | Format: ${list.format} | Status: 📝 Draft\n\n`
        + `Next steps:\n`
        + `1. Use search_printings to find card printing IDs\n`
        + `2. Use add_card_to_list({ listId: "${list.id}", printingId: "..." }) to add cards\n`
        + `3. Use update_curated_list({ id: "${list.id}", isPublished: true }) to publish`;

      return { success: true, message, list };
    } catch (error) {
      console.error('[CreateCuratedList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
