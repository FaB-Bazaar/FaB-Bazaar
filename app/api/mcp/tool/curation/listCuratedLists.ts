// app/api/mcp/tool/curation/listCuratedLists.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const listCuratedListsTool = {
  name: 'list_curated_lists',
  description: `📋 LIST CURATED LISTS: View all curated card lists (curator/admin only)

Shows all curated lists including drafts. Each list includes id, name, hero/class scope,
format, published status, and variant type.

Requires curator or admin role.

Use this to discover list IDs before calling get_curated_list, update_curated_list, or delete_curated_list.

Example workflow:
1. list_curated_lists() → find the list you want to edit
2. get_curated_list({ id }) → view its current cards
3. add_card_to_list / remove_card_from_list → modify cards
4. update_curated_list({ id, isPublished: true }) → publish when ready`,

  parameters: {
    type: 'object',
    properties: {
      heroName: {
        type: 'string',
        description: 'Optional: filter lists by hero name (e.g. "Rhinar")'
      }
    }
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      const queryParams = new URLSearchParams();
      if (params?.heroName) queryParams.set('heroName', params.heroName);

      const url = `${API_BASE_URL}/api/curated-lists${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await mcpFetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to fetch lists (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const lists = result.data || [];

      if (lists.length === 0) {
        return { success: true, message: 'No curated lists found.', lists: [] };
      }

      let message = `📋 **Curated Lists** (${lists.length} total)\n\n`;
      lists.forEach((list: any, i: number) => {
        const scope = list.heroName ? `Hero: ${list.heroName}` : list.className ? `Class: ${list.className}` : 'General';
        const status = list.isPublished ? '✅ Published' : '📝 Draft';
        const variant = list.variantType ? ` [${list.variantType}]` : '';
        message += `${i + 1}. **${list.name}**${variant} | ${scope} | ${list.format || 'CC'} | ${status}\n`;
        message += `   ID: \`${list.id}\` | Cards: ${list.cards?.length ?? 0}\n`;
      });

      message += `\nUse get_curated_list({ id }) to see full card contents.`;

      return { success: true, message, lists };
    } catch (error) {
      console.error('[ListCuratedLists] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
