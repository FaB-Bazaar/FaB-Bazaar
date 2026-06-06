// app/api/mcp/tool/bannedCards/listCardRestrictions.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const listCardRestrictionsTool = {
  name: 'list_card_restrictions',
  description: `📋 LIST CARD RESTRICTIONS: Show the banned_cards registry entries for a format.

Returns one entry per (card, status): banned / restricted / benched / living_legend, each with statusActive and any benching window. Use before managing restrictions to see current state. Entries reference card_unique_id — cross-reference with search_printings for names.`,

  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['silver_age', 'classic_constructed', 'living_legend', 'blitz', 'commoner', 'clash', 'ultimate_pit_fight', 'draft', 'sealed', 'open'],
        description: 'Registry format key (lowercase, e.g. "silver_age").',
      },
      includeInactive: {
        type: 'boolean',
        description: 'Include lifted/inactive entries (full history). Defaults to active only.',
      },
    },
    required: ['format'],
  },

  async handler(params: any, _authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      if (!params?.format) {
        return { success: false, error: 'Missing required parameter: format (e.g. "silver_age").' };
      }

      const qs = new URLSearchParams({ format: params.format });
      if (params.includeInactive) qs.set('includeInactive', 'true');

      const response = await mcpFetch(`${API_BASE_URL}/api/banned-cards?${qs.toString()}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to list restrictions (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const entries: any[] = result.data ?? [];
      const counts = entries.reduce((acc: Record<string, number>, e) => {
        if (e.statusActive !== false) acc[e.restrictionType] = (acc[e.restrictionType] ?? 0) + 1;
        return acc;
      }, {});
      const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'none';

      return {
        success: true,
        data: entries,
        message: `📋 ${params.format}: ${summary} (active).`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list card restrictions.' };
    }
  },
};
