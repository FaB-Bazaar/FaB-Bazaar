// app/api/mcp/tool/curation/updateCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const updateCuratedListTool = {
  name: 'update_curated_list',
  description: `✏️ UPDATE CURATED LIST: Edit a curated list's metadata (curator/admin only)

Update any combination of: name, description, scope, format, tags, published status, variant type.
All fields are optional — only provided fields are updated.

To publish a list: update_curated_list({ id, isPublished: true })
To unpublish: update_curated_list({ id, isPublished: false })

Use list_curated_lists to find list IDs.`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The curated list ID to update'
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
    required: ['id']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      if (!params?.id) {
        return { success: false, error: 'Missing required parameter: id' };
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

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(params.id)}`, {
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
        return { success: false, error: `List not found: ${params.id}` };
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
