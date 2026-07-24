// app/api/mcp/tool/facets/createTag.ts
//
// create_tag — mints a facet VOCABULARY DEFINITION (facet_tag_definitions).
// It never tags a card; assign_card_tag does that. Proxies the curator/superadmin
// admin route, which enforces the role.
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { invalidateFacetTagsCache } from '../../resource/facetTags';

const DIMS = ['mechanical', 'strategic', 'synergy'] as const;
// Mirrors the service's slug rule so bad ids fail fast without a round-trip.
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createTagTool = {
  name: 'create_tag',
  description: `🏷️ CREATE TAG DEFINITION (curator/admin only): Add a NEW tag to the curated facet vocabulary.

⚠️ WHAT THIS IS vs IS NOT — three different things share the word "tag":
  • create_tag    → defines a new VOCABULARY term. It does NOT tag any card.
  • assign_card_tag  → assigns an EXISTING vocabulary tag to a card (curator-authoritative).
  • Community votes on the /tags page are a separate layer — not reachable from these tools.

WORKFLOW:
1. read_mandatory_constants_first({"uri": "fab://facet-tags"}) FIRST — check the concept isn't already covered (avoid near-duplicates like "go-again" vs "grants-go-again").
2. create_tag({ id, dim, label, def })
3. assign_card_tag({ cardUniqueId, tag: "<id>" }) ×N — until cards carry it, searching by this tag returns 0 results.

FIELDS:
  id    — IMMUTABLE kebab-case slug; becomes the value clients pass to search_printings filters.facetTags[] (e.g. "fatigue-answer").
  dim   — mechanical (what the card's text does, observable on the card) | strategic (how it's used / what it's good against) | synergy (named packages and combo lines it plays with).
  label — human display name shown in the UI (e.g. "Fatigue answer").
  def   — one-sentence definition. LOAD-BEARING: other MCP clients read it to decide when the tag applies — write it so a model can apply it correctly.
  draft — optional; a draft tag is hidden from the fab://facet-tags vocabulary until unset.

The fab://facet-tags cache is invalidated on success, so the new tag is visible to clients immediately.`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Immutable kebab-case slug, e.g. "fatigue-answer". This exact string becomes the search_printings facetTags[] value.',
      },
      dim: {
        type: 'string',
        enum: [...DIMS],
        description: 'Dimension: mechanical (on-card text behavior) | strategic (usage/matchup role) | synergy (named package/combo line).',
      },
      label: {
        type: 'string',
        description: 'Human display name, e.g. "Fatigue answer".',
      },
      def: {
        type: 'string',
        description: 'One-sentence definition of when the tag applies. Load-bearing for other MCP clients — be precise.',
      },
      draft: {
        type: 'boolean',
        description: 'Optional. true hides the tag from the fab://facet-tags vocabulary until unset. Defaults to false.',
      },
    },
    required: ['id', 'dim', 'label'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }
      if (typeof params?.id !== 'string' || !SLUG_RE.test(params.id)) {
        return {
          success: false,
          error: `id must be a lowercase kebab-case slug (e.g. "fatigue-answer"); got "${params?.id ?? ''}". It is immutable and becomes the facetTags[] search value.`,
        };
      }
      if (!DIMS.includes(params?.dim)) {
        return {
          success: false,
          error: `dim must be one of: mechanical, strategic, synergy; got "${params?.dim ?? ''}".`,
        };
      }
      if (typeof params?.label !== 'string' || !params.label.trim()) {
        return { success: false, error: 'Missing required parameter: label (human display name).' };
      }

      const body: Record<string, any> = { id: params.id, dim: params.dim, label: params.label };
      if (typeof params.def === 'string') body.def = params.def;
      if (typeof params.draft === 'boolean') body.draft = params.draft;

      const response = await mcpFetch(`${API_BASE_URL}/api/admin/card-facets/tags`, {
        method: 'POST',
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
        return { success: false, error: `Failed to create tag (HTTP ${response.status}): ${apiError}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      await invalidateFacetTagsCache();

      const created = result.data;
      const message =
        `✅ Created tag definition **${created.id}** (${created.dim}${created.draft ? ', draft' : ''}): ${created.label}\n\n` +
        `No cards carry it yet — searching by it returns 0 results until you assign it.\n` +
        `Next: assign_card_tag({ cardUniqueId: "<from search_printings>", tag: "${created.id}" })`;

      return { success: true, data: created, message };
    } catch (err) {
      console.error('[CreateTag] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create tag.' };
    }
  },
};
