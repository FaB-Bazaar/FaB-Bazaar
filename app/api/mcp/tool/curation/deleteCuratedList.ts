// app/api/mcp/tool/curation/deleteCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { classifyIdentifier, resolveList } from '../helpers';

export const deleteCuratedListTool = {
  name: 'delete_curated_list',
  description: `🗑️ DELETE CURATED LIST: Permanently delete a curated list (curator/admin only)

Deletes the list and all its card entries. This action cannot be undone.

📋 Target by id (preferred), or listName + heroName.

Consider using update_curated_list({ id, isPublished: false }) to unpublish instead if you just want to hide it.`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Curated list ID (nanoid). PREFERRED.'
      },
      listName: {
        type: 'string',
        description: 'Curated list name — case-insensitive. Pair with heroName when shared.'
      },
      heroName: {
        type: 'string',
        description: 'Hero to scope listName lookup.'
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

      if (params?.id && classifyIdentifier(params.id) === 'humanName') {
        return {
          success: false,
          error: `"${params.id}" looks like a list name, not an ID. Retry with \`listName: "${params.id}"\` (add \`heroName\` to disambiguate).`,
        };
      }

      let resolvedId = params.id as string | undefined;
      if (!resolvedId) {
        const listResult = await resolveList(params.listName, tokenToUse, { heroName: params.heroName });
        if (!listResult.ok) return { success: false, error: listResult.error };
        resolvedId = listResult.list.id;
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(resolvedId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }
      if (response.status === 404) {
        return { success: false, error: `List not found: ${resolvedId}. Call list_curated_lists() to see valid IDs.` };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to delete list (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      return {
        success: true,
        message: `✅ Deleted list \`${resolvedId}\` and all its cards.`
      };
    } catch (error) {
      console.error('[DeleteCuratedList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
