// app/api/mcp/tool/curation/updateCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { classifyIdentifier, resolveList } from '../helpers';

export const updateCuratedListTool = {
  name: 'update_curated_list',
  description: `✏️ UPDATE CURATED LIST: Edit a curated list's metadata (curator/admin only)

Update any combination of: name, description, scope, format, tags, published status, variant type.
All fields are optional — only provided fields are updated.

To publish a list: update_curated_list({ id, isPublished: true })
To unpublish: update_curated_list({ id, isPublished: false })

📋 You can target the list by id (preferred), or listName + targetHeroName.
(targetHeroName is lookup-only — it does NOT change the list's hero scope.
 To change the list's hero scope, set the \`heroName\` field below.)

Use list_curated_lists to find list IDs.`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Curated list ID (nanoid from list_curated_lists). PREFERRED.'
      },
      listName: {
        type: 'string',
        description: 'Curated list name — case-insensitive. Pair with heroName when the name is shared across heroes.'
      },
      targetHeroName: {
        type: 'string',
        description: 'Hero to scope listName lookup. Not to be confused with `heroName` below, which CHANGES the list\'s hero scope.'
      },
      name: {
        type: 'string',
        description: 'New list name'
      },
      description: {
        type: 'string',
        description: 'New description'
      },
      heroName: {
        type: 'string',
        description: 'Hero scope (set to null to clear)'
      },
      className: {
        type: 'string',
        description: 'Class scope (set to null to clear)'
      },
      format: {
        type: 'string',
        description: 'Game format (e.g. "CC", "Blitz")'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Replace all tags with this list'
      },
      isPublished: {
        type: 'boolean',
        description: 'true to publish, false to unpublish'
      },
      variantType: {
        type: 'string',
        enum: ['budget', 'mid', 'premium'],
        description: 'Pricing tier variant'
      },
      sortOrder: {
        type: 'number',
        description: 'Display sort order'
      }
    },
    required: []
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      if (!params?.id && !params?.listName) {
        return { success: false, error: 'Missing required parameter: id or listName' };
      }

      // Shape hint: treat a name-looking `id` as a typo.
      if (params?.id) {
        const shape = classifyIdentifier(params.id);
        if (shape === 'humanName') {
          return {
            success: false,
            error: `"${params.id}" looks like a list name, not an ID. Retry with \`listName: "${params.id}"\` (add \`targetHeroName\` to disambiguate).`,
          };
        }
      }

      // Resolve via name+hero if id not given
      let resolvedId = params.id as string | undefined;
      if (!resolvedId) {
        const listResult = await resolveList(params.listName, tokenToUse, { heroName: params.targetHeroName });
        if (!listResult.ok) return { success: false, error: listResult.error };
        resolvedId = listResult.list.id;
      }

      const body: Record<string, any> = {};
      if (params.name !== undefined) body.name = params.name;
      if (params.description !== undefined) body.description = params.description;
      if (params.heroName !== undefined) body.heroName = params.heroName;
      if (params.className !== undefined) body.className = params.className;
      if (params.format !== undefined) body.format = params.format;
      if (params.tags !== undefined) body.tags = params.tags;
      if (params.isPublished !== undefined) body.isPublished = params.isPublished;
      if (params.variantType !== undefined) body.variantType = params.variantType;
      if (params.sortOrder !== undefined) body.sortOrder = params.sortOrder;

      if (Object.keys(body).length === 0) {
        return { success: false, error: 'No fields to update. Provide at least one field to change.' };
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(resolvedId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify(body)
      });

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }
      if (response.status === 404) {
        return { success: false, error: `List not found: ${resolvedId}. Call list_curated_lists() to see valid IDs.` };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to update list (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const list = result.data;
      const updatedFields = Object.keys(body).join(', ');
      const publishStatus = list.isPublished ? '✅ Published' : '📝 Draft';

      const message = `✅ Updated list: **${list.name}**\n`
        + `ID: \`${list.id}\` | Status: ${publishStatus}\n`
        + `Updated fields: ${updatedFields}`;

      return { success: true, message, list };
    } catch (error) {
      console.error('[UpdateCuratedList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
