// app/api/mcp/tool/curation/createCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const createCuratedListTool = {
  name: 'create_curated_list',
  description: `✨ CREATE CURATED LIST: Create a new curated card list (curator/admin only)

Creates a draft list scoped to a specific hero, class, or general use.
New lists start unpublished — use update_curated_list to publish when ready.

Scope options:
- "general": applies to all heroes/classes
- "class": requires className (e.g. "Warrior")
- "hero": requires heroName (e.g. "Rhinar")

Variant types (optional): "budget", "mid", "premium"
  Use parentId to link variants to a parent list.

Example workflow:
1. create_curated_list({ name: "Rhinar Core", scope: "hero", heroName: "Rhinar", format: "CC" })
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
      description: {
        type: 'string',
        description: 'Optional description of the list purpose'
      },
      scope: {
        type: 'string',
        enum: ['general', 'class', 'hero'],
        description: 'Scope: "general" (all), "class" (requires className), or "hero" (requires heroName)'
      },
      heroName: {
        type: 'string',
        description: 'Required when scope is "hero" (e.g. "Rhinar")'
      },
      className: {
        type: 'string',
        description: 'Required when scope is "class" (e.g. "Warrior")'
      },
      format: {
        type: 'string',
        description: 'Game format (e.g. "CC", "Blitz", "Commoner"). Defaults to "CC"'
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
    required: ['name', 'scope']
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
      if (!params?.scope) {
        return { success: false, error: 'Missing required parameter: scope' };
      }
      if (params.scope === 'hero' && !params.heroName) {
        return { success: false, error: 'heroName is required when scope is "hero"' };
      }
      if (params.scope === 'class' && !params.className) {
        return { success: false, error: 'className is required when scope is "class"' };
      }

      const body: Record<string, any> = {
        name: params.name,
        format: params.format || 'CC',
      };
      if (params.description) body.description = params.description;
      if (params.scope === 'hero') body.heroName = params.heroName;
      if (params.scope === 'class') body.className = params.className;
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
      const scope = list.heroName ? `Hero: ${list.heroName}` : list.className ? `Class: ${list.className}` : 'General';

      const message = `✅ Created list: **${list.name}**\n`
        + `ID: \`${list.id}\`\n`
        + `Scope: ${scope} | Format: ${list.format || 'CC'} | Status: 📝 Draft\n\n`
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
