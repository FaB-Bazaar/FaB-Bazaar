// app/api/mcp/tool/facets/addCardTag.ts
//
// add_card_tag — assigns an EXISTING vocabulary tag to a card as a curator
// (authoritative layer, live in search immediately). Proxies the admin assign
// route, which enforces the curator/superadmin role.
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { invalidateFacetTagsCache } from '../../resource/facetTags';

export const CARD_TAG_SCOPES = ['name', 'card'] as const;

export function validateCardTagParams(params: any): string | null {
  if (typeof params?.cardUniqueId !== 'string' || !params.cardUniqueId) {
    return 'Missing required parameter: cardUniqueId — the card_unique_id from a search_printings result row (NOT a printing_id).';
  }
  if (typeof params?.tag !== 'string' || !params.tag) {
    return 'Missing required parameter: tag — a tag id from fab://facet-tags (or one you just created with create_tag).';
  }
  if (params.scope !== undefined && !CARD_TAG_SCOPES.includes(params.scope)) {
    return `scope must be 'name' (all same-name pitch variants, default) or 'card' (this exact card_unique_id only); got "${params.scope}".`;
  }
  return null;
}

const SHARED_DESCRIPTION = `⚠️ WHAT THIS IS vs IS NOT:
  • add_card_tag / remove_card_tag → put an EXISTING vocabulary tag on / off a card. Curator-authoritative: live in search immediately, no votes needed.
  • create_tag → defines a NEW vocabulary term (does not touch any card). Use it first if the tag doesn't exist in fab://facet-tags.
  • Community votes on the /tags page are a separate layer these tools do not touch.

IDs — read carefully:
  cardUniqueId — the card_unique_id (21-char nanoid) from a search_printings result row. NOT a printing_id, NOT a collector number. One card at one pitch, across all printings.
  tag          — the kebab-case tag id from fab://facet-tags (read it first; ids alone mislead).

SCOPE:
  'name' (default) — fans out to every same-name pitch variant (red/yellow/blue). Right for most tags.
  'card'           — only the exact card_unique_id (per-pitch rulings, e.g. the red does this but the blue doesn't).`;

async function callAssignRoute(
  method: 'POST' | 'DELETE',
  params: any,
  authenticatedUser: any,
  token: string | undefined,
  verb: 'tag' | 'untag',
) {
  const API_BASE_URL = getMcpApiBaseUrl();
  try {
    const tokenToUse = authenticatedUser?.mcpToken || token;
    if (!tokenToUse) {
      return { success: false, error: 'Authentication required: no token found.' };
    }
    const validationError = validateCardTagParams(params);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const body: Record<string, any> = { cardUniqueId: params.cardUniqueId, tag: params.tag };
    if (params.scope) body.scope = params.scope;

    const response = await mcpFetch(`${API_BASE_URL}/api/admin/card-facets/assign`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` },
      body: JSON.stringify(body),
    });

    if (response.status === 403) {
      return { success: false, error: 'Access denied: curator or admin role required.' };
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let apiError = errorText;
      try {
        apiError = JSON.parse(errorText)?.error || errorText;
      } catch { /* not JSON — use raw body */ }
      return { success: false, error: `Failed to ${verb} card (HTTP ${response.status}): ${apiError}` };
    }

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'API returned an error.' };
    }

    // Per-tag card counts in fab://facet-tags just changed.
    await invalidateFacetTagsCache();

    const applied = result.data?.applied ?? 0;
    const fanout =
      body.scope === 'card'
        ? 'this exact card only'
        : `${applied} same-name pitch variant${applied === 1 ? '' : 's'}`;
    const message =
      verb === 'tag'
        ? `✅ Tagged **${params.tag}** onto ${fanout} (${applied} card${applied === 1 ? '' : 's'} affected). Live in search_printings facetTags[] immediately.`
        : `✅ Removed **${params.tag}** from ${fanout} (${applied} card${applied === 1 ? '' : 's'} affected).`;

    return { success: true, data: result.data, message };
  } catch (err) {
    console.error(`[${verb === 'tag' ? 'AddCardTag' : 'RemoveCardTag'}] Error:`, err);
    return { success: false, error: err instanceof Error ? err.message : `Failed to ${verb} card.` };
  }
}

export const addCardTagTool = {
  name: 'add_card_tag',
  description: `🏷️ TAG A CARD (curator/admin only): Assign an existing facet tag to a card.

${SHARED_DESCRIPTION}

WORKFLOW: search_printings → copy card_unique_id from the result row → add_card_tag({ cardUniqueId, tag }). If the API answers "unknown tag", the tag isn't in the vocabulary yet — create_tag first.`,

  parameters: {
    type: 'object',
    properties: {
      cardUniqueId: {
        type: 'string',
        description: 'card_unique_id from a search_printings result row (21-char nanoid). NOT a printing_id.',
      },
      tag: {
        type: 'string',
        description: 'Existing tag id (kebab-case slug) from fab://facet-tags, e.g. "fatigue-answer".',
      },
      scope: {
        type: 'string',
        enum: [...CARD_TAG_SCOPES],
        description: "Optional. 'name' (default): all same-name pitch variants. 'card': only this exact card_unique_id.",
      },
    },
    required: ['cardUniqueId', 'tag'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    return callAssignRoute('POST', params, authenticatedUser, token, 'tag');
  },
};

export { callAssignRoute };
