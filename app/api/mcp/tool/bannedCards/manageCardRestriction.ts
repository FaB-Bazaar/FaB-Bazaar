// app/api/mcp/tool/bannedCards/manageCardRestriction.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

const STATUS_LABEL: Record<string, string> = {
  banned: 'Banned',
  restricted: 'Restricted (1-of)',
  benched: 'Benched',
  living_legend: 'Living Legend',
};

export const manageCardRestrictionTool = {
  name: 'manage_card_restriction',
  description: `🚫 MANAGE CARD RESTRICTION (superadmin only): Set or lift a card's restriction in a format.

The banned_cards registry is the single source of truth for FaB's legality taxonomy. One call upserts a (card, format, status) entry; recompute projects it into the deck-builder/search automatically.

STATUSES (FaB policy):
  • banned        — permanent, per format
  • restricted    — Living Legend 1-of (max 1 copy per deck)
  • benched       — Silver Age heroes, TIME-BOXED (set dateExpires / untilSet)
  • living_legend — adult hero + signature weapon that graduated out of Classic Constructed

LIFT: pass active=false to deactivate an existing entry (preserves history).

cardUniqueId is the 21-char card id — harvest it from search_printings (NOT a printing_id or collector_number). For a hero+weapon Living Legend pair, call this twice (once per card).`,

  parameters: {
    type: 'object',
    properties: {
      cardUniqueId: {
        type: 'string',
        description: '21-char card_unique_id (from search_printings). One card at one pitch.',
      },
      format: {
        type: 'string',
        enum: ['silver_age', 'classic_constructed', 'living_legend', 'blitz', 'commoner', 'clash', 'ultimate_pit_fight', 'draft', 'sealed', 'open'],
        description: 'Registry format key (lowercase, e.g. "classic_constructed").',
      },
      status: {
        type: 'string',
        enum: ['banned', 'restricted', 'benched', 'living_legend'],
        description: 'Restriction status. Defaults to "banned".',
      },
      active: {
        type: 'boolean',
        description: 'true to set the restriction (default), false to LIFT it (soft-delete, keeps history).',
      },
      dateInEffect: { type: 'string', description: 'ISO date the restriction takes effect (benched "from").' },
      dateExpires: { type: 'string', description: 'ISO date a benched window ends ("until"). Benched only.' },
      untilSet: { type: 'string', description: 'Human "until" label, e.g. "Set 20". Benched only.' },
      reason: {
        type: 'string',
        enum: ['lss_pick', 'community_vote'],
        description: 'Why a hero was benched. Benched only.',
      },
      legalityArticle: { type: 'string', description: 'Optional URL to the B&R / legality announcement.' },
    },
    required: ['cardUniqueId', 'format'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }
      if (!params?.cardUniqueId) {
        return { success: false, error: 'Missing required parameter: cardUniqueId (harvest it from search_printings).' };
      }
      if (!params?.format) {
        return { success: false, error: 'Missing required parameter: format (e.g. "classic_constructed").' };
      }

      const status = params.status ?? 'banned';
      const active = params.active ?? true;

      const body: Record<string, any> = {
        cardUniqueId: params.cardUniqueId,
        format: params.format,
        restrictionType: status,
        statusActive: active,
      };
      if (params.dateInEffect) body.dateInEffect = params.dateInEffect;
      if (params.dateExpires) body.dateExpires = params.dateExpires;
      if (params.untilSet) body.untilSet = params.untilSet;
      if (params.reason) body.reason = params.reason;
      if (params.legalityArticle) body.legalityArticle = params.legalityArticle;

      const response = await mcpFetch(`${API_BASE_URL}/api/banned-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` },
        body: JSON.stringify(body),
      });

      if (response.status === 403) {
        return { success: false, error: 'Access denied: Super Admin role required.' };
      }
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to update restriction (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const label = STATUS_LABEL[status] ?? status;
      const verb = active ? 'Set' : 'Lifted';
      const window = params.untilSet ? ` (until ${params.untilSet})` : params.dateExpires ? ` (until ${params.dateExpires.slice(0, 10)})` : '';
      const message = `✅ ${verb} **${label}**${window} for \`${params.cardUniqueId}\` in ${params.format}.`;

      return { success: true, data: result.data, message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to manage card restriction.' };
    }
  },
};
