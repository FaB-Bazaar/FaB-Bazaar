// app/api/mcp/tool/curation/deleteCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const deleteCuratedListTool = {
  name: 'delete_curated_list',
  description: `🗑️ DELETE CURATED LIST: Permanently delete a curated list (curator/admin only)

Deletes the list and all its card entries. This action cannot be undone.

Use list_curated_lists to find the ID of the list to delete.
Consider using update_curated_list({ id, isPublished: false }) to unpublish instead if you just want to hide it.`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The curated list ID to delete'
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

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(params.id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }
      if (response.status === 404) {
        return { success: false, error: `List not found: ${params.id}` };
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
        message: `✅ Deleted list \`${params.id}\` and all its cards.`
      };
    } catch (error) {
      console.error('[DeleteCuratedList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
