// app/api/mcp/tool/curation/getCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { classifyIdentifier, resolveList, validateListIdentifierParams } from '../helpers';

export const getCuratedListTool = {
  name: 'get_curated_list',
  _meta: {
    ui: { resourceUri: 'ui://card-grid/viewer.html' },
  },
  description: `📖 GET CURATED LIST: View a single curated list with all its cards

Returns list metadata plus an ordered list of cards with printing IDs, display names, set codes,
image URLs, and pricing. Cards render as an interactive grid in the MCP Apps iframe.

🎯 DECK RECOMMENDATIONS: use this right after list_curated_lists({ heroName }) when a user asks
for deck or card recommendations for a hero — the list's cards are the curator's picks to build
around. Quote them directly instead of inventing suggestions.

📋 THREE WAYS TO IDENTIFY THE LIST (preferred order):
Option A — id (or listId): exact list ID (nanoid from list_curated_lists). PREFERRED.
Option B — listName + heroName: name scoped to one hero.
Option C — listName alone: only for generic lists. Errors on ambiguity.

Example workflows:
• Recommendation: list_curated_lists({ heroName: "Prism" }) → get_curated_list({ id }) → quote staples
• Curator edit: list_curated_lists() → get_curated_list({ id }) → add_card_to_list / remove_card_from_list`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Curated list ID (nanoid from list_curated_lists). Alias: listId.'
      },
      listId: {
        type: 'string',
        description: 'Alias for id.'
      },
      listName: {
        type: 'string',
        description: 'Curated list name (case-insensitive). Pair with heroName when shared across heroes.'
      },
      heroName: {
        type: 'string',
        description: 'Hero to scope listName lookup.'
      },
      showDetails: {
        type: 'boolean',
        default: true,
        description:
          'When true (default) the text response contains a markdown table of all cards in the list (Name / Set / Rarity / Price), letting you answer follow-up questions without another call. Set to false ONLY when the user just wants to browse visually and you want to save context tokens. The interactive widget renders either way.'
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

      const rawId = params?.listId ?? params?.id;
      if (!rawId && !params?.listName) {
        return { success: false, error: 'Missing required parameter: id (listId) or listName' };
      }

      // If the caller passed a human-name-looking value into `id`, hint them.
      if (rawId) {
        const shape = classifyIdentifier(rawId);
        if (shape === 'humanName') {
          return {
            success: false,
            error: `"${rawId}" looks like a list name, not an ID. Retry with \`listName: "${rawId}"\` (add \`heroName\` to disambiguate if needed).`,
          };
        }
      } else {
        const shapeErr = validateListIdentifierParams({ listName: params.listName });
        if (shapeErr) return { success: false, error: shapeErr };
      }

      // Resolve via name+hero if id not given
      let resolvedId = rawId as string | undefined;
      if (!resolvedId) {
        const listResult = await resolveList(params.listName, tokenToUse, { heroName: params.heroName });
        if (!listResult.ok) return { success: false, error: listResult.error };
        resolvedId = listResult.list.id;
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(resolvedId)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (response.status === 404) {
        return { success: false, error: `List not found: ${resolvedId}. Call list_curated_lists() to see valid IDs.` };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to fetch list (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const list = result.data;
      const scope = list.heroName ? `Hero: ${list.heroName}` : list.className ? `Class: ${list.className}` : 'General';
      const status = list.isPublished ? '✅ Published' : '📝 Draft';

      let message = `📖 **${list.name}**\n`;
      message += `Scope: ${scope} | Format: ${list.format || 'CC'} | Status: ${status}\n`;
      if (list.description) message += `Description: ${list.description}\n`;
      if (list.variantType) message += `Variant: ${list.variantType}\n`;
      if (list.tags?.length) message += `Tags: ${list.tags.join(', ')}\n`;
      message += `ID: \`${list.id}\`\n\n`;

      const cards = list.cards || [];
      if (cards.length === 0) {
        message += `No cards in this list yet. Use add_card_to_list to populate it.`;
      } else {
        message += `**Cards** (${cards.length} total):\n`;
        cards.forEach((card: any, i: number) => {
          message += `${i + 1}. ${card.displayName || 'Unknown'} | Set: ${card.setCode || '?'} | Printing ID: \`${card.printingId}\` | Card Entry ID: \`${card.id}\`\n`;
        });
        message += `\nUse card entry IDs (not printing IDs) with remove_card_from_list.`;
      }

      return { success: true, message, list };
    } catch (error) {
      console.error('[GetCuratedList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};

type McpAppResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, any>;
  isError?: boolean;
};

const FOIL_LABELS: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
const RARITY_LABELS: Record<string, string> = {
  c: 'Common', r: 'Rare', s: 'Super Rare', m: 'Majestic',
  l: 'Legendary', f: 'Fabled', t: 'Token', b: 'Basic', v: 'Marvel', p: 'Promo',
};

function cPipe(s: string): string { return s.replace(/\|/g, '\\|'); }

function mapCuratedCard(c: any): any {
  return {
    name: c.displayName ?? c.name ?? '',
    display_name: c.displayName ?? c.name ?? '',
    printingId: c.printingId,
    set: c.setCode ?? c.set,
    collector_number: c.collectorNumber ?? c.collector_number,
    rarity: c.rarity,
    foiling: c.foiling,
    edition: c.edition,
    tcg_low: c.tcgLow ?? c.tcg_low,
    tcg_market: c.tcgMarket ?? c.tcg_market,
    image_url: c.imageUrl ?? c.image_url,
    quantity: 1,
  };
}

function buildCuratedTable(cards: any[]): string {
  const header = '| # | Name | Set | Rarity | Price |\n' +
                 '|--:|------|:---:|:------:|------:|';
  const rows = cards.map((c, i) => {
    const name = cPipe(String(c.name ?? ''));
    const set = c.set ? String(c.set).toUpperCase() : '';
    const rarity = c.rarity ? (RARITY_LABELS[String(c.rarity).toLowerCase()] ?? c.rarity) : '';
    const priceRaw = c.tcg_market ?? c.tcg_low;
    const price = priceRaw == null ? '—' : `$${Number(priceRaw).toFixed(2)}`;
    return `| ${i + 1} | ${name} | ${set} | ${rarity} | ${price} |`;
  });
  return [header, ...rows].join('\n');
}

export function shapeCuratedListForMcp(
  raw: any,
  opts: { showDetails?: boolean } = {}
): McpAppResult {
  if (!raw || raw.success === false) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error retrieving curated list: ${raw?.error ?? 'unknown error'}` }],
    };
  }

  const showDetails = opts.showDetails !== false;
  const list = raw.list ?? {};
  const name = list.name ?? 'Curated list';
  const scope = list.heroName ? `Hero: ${list.heroName}` : list.className ? `Class: ${list.className}` : 'General';
  const status = list.isPublished ? 'Published' : 'Draft';
  const format = list.format || 'CC';
  const subtitle = `${scope} · ${format} · ${status}`;

  const rawCards: any[] = Array.isArray(list.cards) ? list.cards : [];
  const widgetCards = rawCards.map(mapCuratedCard);

  const heading = `List '${name}' — ${rawCards.length} cards (${subtitle})`;
  const parts = [heading];
  if (list.description) parts.push(list.description);
  if (showDetails && widgetCards.length > 0) parts.push('', buildCuratedTable(widgetCards));
  const text = parts.join('\n');

  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      title: name,
      subtitle,
      filters: { rarity: true, set: true },
      cards: widgetCards,
      list,
    },
  };
}
