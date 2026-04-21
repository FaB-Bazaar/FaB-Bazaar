// app/api/mcp/tool/getDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

const FOILING_MAP: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
const EDITION_MAP: Record<string, string> = { f: '1st', a: 'A', u: 'UNL', n: '' };
const PITCH_COLOR: Record<string, string> = { '1': 'Red', '2': 'Yellow', '3': 'Blue' };

const EQUIPMENT_SLOTS = ['head', 'chest', 'arms', 'legs', 'off-hand'] as const;
type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];

// Canonical type buckets used for maindeck grouping (first match wins).
const MAIN_TYPE_PRIORITY: Array<[string, string]> = [
  ['attack reaction', 'Attack Reactions'],
  ['defense reaction', 'Defense Reactions'],
  ['instant', 'Instants'],
  ['attack action', 'Attack Actions'],
  ['non-attack action', 'Non-Attack Actions'],
  ['action', 'Actions'],
  ['item', 'Items'],
  ['ally', 'Allies'],
  ['resource', 'Resources'],
];

function formatCardLine(card: any): string {
  const qty = card.quantity || 1;
  // Card fields are nested under printingDetails in the deck DTO
  const p = card.printingDetails || {};
  const name = p.display_name || p.name || card.display_name || card.name || 'Unknown';
  const foiling = FOILING_MAP[(p.foiling || card.foiling)?.toLowerCase()] ?? p.foiling ?? card.foiling ?? 'NF';
  const edition = EDITION_MAP[(p.edition || card.edition)?.toLowerCase()] ?? p.edition ?? card.edition ?? '';
  const pitch = String(p.pitch ?? card.pitch ?? '');
  const color = PITCH_COLOR[pitch] || '—';
  const types: string[] = p.types || card.types || [];
  const typeStr = Array.isArray(types) ? types.join(', ') : (types || '—');
  const collectorNum = p.collector_number || card.collector_number || '';
  const setCode = (p.set || card.set || '').toUpperCase();
  const cardId = collectorNum ? `${setCode}${collectorNum}` : '—';
  const editionDisplay = edition || '—';

  return `| ${qty} | ${name} | ${color} | ${typeStr || '—'} | ${foiling} | ${editionDisplay} | ${cardId} |`;
}

export const getDeckTool = {
  name: 'get_deck',
  description: `🃏 VIEW DECK CONTENTS: Get the full decklist for one of your decks

  Retrieves all cards in a deck organised by category (Hero, Equipment, Maindeck, etc.)
  Look up by deck name — no need to know internal IDs.

  This tool works independently - no setup required.

  🖥️ DISPLAY INSTRUCTIONS (IMPORTANT):
  Always render the full decklist as markdown tables grouped by category.
  Do NOT summarise — show every card row.

  **Hero** (1 card)
  | Qty | Name                          | Color | Types | Foiling | Edition | Card ID |
  |-----|-------------------------------|-------|-------|---------|---------|---------|
  | 1   | Teklovossen, Esteemed Magnate | —     | Hero  | NF      | —       | EVO001  |

  **Equipment** (X cards)
  | Qty | Name              | Color | Types     | Foiling | Edition | Card ID |
  |-----|-------------------|-------|-----------|---------|---------|---------|
  | 1   | Teklo Leveler     | —     | Equipment | NF      | —       | EVO045  |

  **Maindeck** (X cards)
  | Qty | Name              | Color  | Types           | Foiling | Edition | Card ID |
  |-----|-------------------|--------|-----------------|---------|---------|---------|
  | 3   | Sink Below        | Blue   | Defense Reaction | NF     | —       | CRU050  |

  Then show: "Total: X cards across Y unique entries."

  📋 **CALL FORMAT:**
  { "deckName": "Katsu Aggro" }

  💡 WORKFLOW:
  Step 1: list_decks (find deck names)
  Step 2: get_deck with the exact deck name from list_decks`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'The name of the deck to retrieve (case-insensitive match)'
      },
      showDetails: {
        type: 'boolean',
        default: true,
        description:
          'When true (default) the text response contains a full markdown decklist grouped by category. Set to false ONLY when the user just wants to browse the deck visually and you want to save context tokens. The interactive widget renders either way.'
      }
    },
    required: ['deckName']
  },

  _meta: {
    ui: { resourceUri: 'ui://deck/viewer.html' },
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token was found.' };
      }

      const { deckName } = params;
      if (!deckName) {
        return { success: false, error: 'deckName is required.' };
      }

      // Step 1: list decks to find the publicId matching this name
      const listResponse = await mcpFetch(`${API_BASE_URL}/api/decks?limit=100`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (!listResponse.ok) {
        return { success: false, error: `Failed to fetch deck list (HTTP ${listResponse.status}).` };
      }

      const listResult = await listResponse.json();
      if (!listResult.success) {
        return { success: false, error: listResult.error || 'Could not load deck list.' };
      }

      const match = (listResult.decks || []).find(
        (d: any) => d.name?.toLowerCase() === deckName.toLowerCase()
      );

      if (!match) {
        const available = (listResult.decks || []).map((d: any) => d.name).join(', ');
        return {
          success: false,
          error: `No deck named "${deckName}" found. Available decks: ${available}`
        };
      }

      // Step 2: fetch deck detail by publicId
      const deckResponse = await mcpFetch(`${API_BASE_URL}/api/decks/${match.publicId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (!deckResponse.ok) {
        return { success: false, error: `Failed to fetch deck (HTTP ${deckResponse.status}).` };
      }

      const deckResult = await deckResponse.json();
      if (!deckResult.success) {
        return { success: false, error: deckResult.error || 'Could not load deck.' };
      }

      const deck = deckResult.data;
      // Service returns category arrays as top-level properties (not nested under .categories)
      const categories: Record<string, any[]> = {
        hero: deck.hero || [],
        equipment: deck.equipment || [],
        maindeck: deck.maindeck || [],
        sideboard: deck.sideboard || [],
        inventory: deck.inventory || [],
        maybeboard: deck.maybeboard || [],
        tokens: deck.tokens || [],
      };

      // Build formatted message grouped by category
      const categoryOrder = ['hero', 'equipment', 'maindeck', 'sideboard', 'inventory', 'maybeboard', 'tokens'];
      const categoryLabels: Record<string, string> = {
        hero: 'Hero',
        equipment: 'Equipment',
        maindeck: 'Maindeck',
        sideboard: 'Sideboard',
        inventory: 'Inventory',
        maybeboard: 'Maybeboard',
        tokens: 'Tokens',
      };

      let message = `🃏 **${deck.name}**`;
      if (deck.heroName) message += ` — ${deck.heroName}`;
      if (deck.format) message += ` (${deck.format})`;
      message += '\n\n';
      if (deck.description) message += `📝 ${deck.description}\n\n`;
      if (deck.eventName) {
        message += `🏆 **${deck.eventName}**`;
        if (deck.eventDate) message += ` — ${deck.eventDate}`;
        if (deck.placing) message += ` | ${deck.placing}${['st','nd','rd'][((deck.placing+90)%100-10)%10-1]||'th'} place`;
        message += '\n\n';
      }

      let totalCards = 0;
      let totalUnique = 0;

      for (const cat of categoryOrder) {
        const cards: any[] = categories[cat] || [];
        if (cards.length === 0) continue;

        const catTotal = cards.reduce((s: number, c: any) => s + (c.quantity || 1), 0);
        totalCards += catTotal;
        totalUnique += cards.length;

        message += `**${categoryLabels[cat] || cat}** (${catTotal} cards)\n`;
        message += `| Qty | Name | Color | Types | Foiling | Edition | Card ID |\n`;
        message += `|-----|------|-------|-------|---------|---------|--------|\n`;
        cards.forEach((card: any) => {
          message += `${formatCardLine(card)}\n`;
        });
        message += '\n';
      }

      message += `_Total: ${totalCards} cards across ${totalUnique} unique entries._`;

      return {
        success: true,
        message,
        deck: {
          name: deck.name,
          publicId: deck.publicId,
          heroName: deck.heroName,
          format: deck.format,
          isPublic: deck.isPublic,
          description: deck.description ?? null,
          eventName: deck.eventName ?? null,
          eventDate: deck.eventDate ?? null,
          placing: deck.placing ?? null,
          estimatedValue: deck.estimatedValue ?? 0,
          totalCards,
          categories,
          metadata: deck.metadata ?? null,
        }
      };

    } catch (error) {
      console.error('[GetDeck] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};

// ---- MCP Apps shape helpers ----

type McpAppResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, any>;
  isError?: boolean;
};

function lowerTypes(types: any): string[] {
  if (!Array.isArray(types)) return [];
  return types.map((t) => String(t).toLowerCase());
}

function primaryCategoryLabel(types: string[]): string {
  for (const [needle, label] of MAIN_TYPE_PRIORITY) {
    if (types.some((t) => t.includes(needle))) return label;
  }
  return 'Other';
}

function equipmentSlot(types: string[]): EquipmentSlot | null {
  for (const slot of EQUIPMENT_SLOTS) {
    if (types.includes(slot)) return slot;
  }
  return null;
}

function isWeapon(types: string[]): boolean {
  return types.includes('weapon');
}

function shapeCard(raw: any): any {
  const p = raw.printingDetails || {};
  const types = lowerTypes(p.types ?? raw.types);
  return {
    printingId: raw.printingId,
    quantity: raw.quantity ?? 1,
    name: p.display_name || p.name || 'Unknown',
    display_name: p.display_name || p.name || 'Unknown',
    set: p.set ?? '',
    collector_number: p.collector_number ?? '',
    edition: p.edition ?? '',
    foiling: p.foiling ?? '',
    rarity: p.rarity ?? '',
    image_url: p.image_url ?? '',
    other_face_image_url: p.other_face_image_url ?? null,
    tcg_market: p.tcg_market ?? null,
    tcg_low: p.tcg_low ?? null,
    pitch: p.pitch ?? 0,
    cost: p.cost ?? null,
    defense: p.defense ?? null,
    power: p.power ?? null,
    types,
    keywords: Array.isArray(p.keywords) ? p.keywords : [],
    classes: Array.isArray(p.classes) ? p.classes : [],
    talents: Array.isArray(p.talents) ? p.talents : [],
    text: p.text ?? '',
  };
}

function humanizeHeroId(heroId: string): string {
  return heroId
    .replace(/_+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function computeStats(maindeck: any[]): {
  byPitch: Record<string, number>;
  byCost: Record<string, number>;
  byType: Record<string, number>;
  byKeyword: Record<string, number>;
  totalCards: number;
} {
  const byPitch: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0 };
  const byCost: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byKeyword: Record<string, number> = {};
  let totalCards = 0;

  for (const c of maindeck) {
    const qty = c.quantity ?? 1;
    totalCards += qty;

    const pitch = String(c.pitch ?? 0);
    byPitch[pitch] = (byPitch[pitch] ?? 0) + qty;

    const cost = c.cost == null ? 'x' : String(c.cost);
    byCost[cost] = (byCost[cost] ?? 0) + qty;

    const typeLabel = primaryCategoryLabel(c.types);
    byType[typeLabel] = (byType[typeLabel] ?? 0) + qty;

    for (const kw of c.keywords ?? []) {
      const key = String(kw).toLowerCase();
      byKeyword[key] = (byKeyword[key] ?? 0) + qty;
    }
  }

  return { byPitch, byCost, byType, byKeyword, totalCards };
}

function buildDeckText(deck: any, shaped: any, showDetails: boolean): string {
  const lines: string[] = [];
  lines.push(`🃏 **${deck.name}**${deck.heroName ? ` — ${deck.heroName}` : ''}${deck.format ? ` (${deck.format})` : ''}`);
  if (deck.description) lines.push(`📝 ${deck.description}`);
  if (deck.eventName) {
    const place = deck.placing ? ` · ${deck.placing} place` : '';
    const date = deck.eventDate ? ` · ${deck.eventDate}` : '';
    lines.push(`🏆 ${deck.eventName}${date}${place}`);
  }
  lines.push(`Cards: ${shaped.meta.totalCards} · Est. value: $${(shaped.meta.estimatedValue ?? 0).toFixed(2)}`);

  if (!showDetails) return lines.join('\n');

  const printRow = (c: any) => {
    const qty = c.quantity ?? 1;
    const color = PITCH_COLOR[String(c.pitch)] ?? '—';
    const cost = c.cost == null ? '—' : c.cost;
    const name = c.display_name || c.name;
    return `| ${qty} | ${name} | ${color} | ${cost} |`;
  };

  const section = (label: string, cards: any[]) => {
    if (!cards.length) return;
    const total = cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
    lines.push('');
    lines.push(`**${label}** (${total})`);
    lines.push('| Qty | Name | Pitch | Cost |');
    lines.push('|----:|------|:-----:|:----:|');
    cards.forEach((c) => lines.push(printRow(c)));
  };

  if (shaped.heroCard) section('Hero', [shaped.heroCard]);
  const equipmentAll = [
    ...(shaped.weapon ? [shaped.weapon] : []),
    ...EQUIPMENT_SLOTS.flatMap((s) => shaped.equipment[s] ?? []),
    ...(shaped.equipment.other ?? []),
  ];
  section('Equipment', equipmentAll);

  // Group maindeck by primary type
  const grouped: Record<string, any[]> = {};
  for (const c of shaped.categories.maindeck) {
    const label = primaryCategoryLabel(c.types);
    (grouped[label] ||= []).push(c);
  }
  for (const [, label] of MAIN_TYPE_PRIORITY) {
    if (grouped[label]) section(label, grouped[label]);
  }
  if (grouped['Other']) section('Other', grouped['Other']);

  section('Inventory', shaped.categories.inventory ?? []);
  section('Tokens', shaped.categories.tokens ?? []);

  return lines.join('\n');
}

export function shapeDeckForMcp(
  raw: any,
  opts: { showDetails?: boolean } = {}
): McpAppResult {
  if (!raw || raw.success === false) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error retrieving deck: ${raw?.error ?? 'unknown error'}` }],
    };
  }

  const showDetails = opts.showDetails !== false;
  const deck = raw.deck ?? {};
  const categories = deck.categories ?? {};

  const heroCardRaw = (categories.hero ?? [])[0];
  const heroCard = heroCardRaw ? shapeCard(heroCardRaw) : null;

  const equipmentRaw: any[] = categories.equipment ?? [];
  const equipmentShaped = equipmentRaw.map(shapeCard);
  let weapon: any = null;
  const slots: Record<EquipmentSlot, any[]> = {
    head: [], chest: [], arms: [], legs: [], 'off-hand': [],
  };
  const otherEquipment: any[] = [];
  for (const card of equipmentShaped) {
    if (!weapon && isWeapon(card.types)) {
      weapon = card;
      continue;
    }
    const slot = equipmentSlot(card.types);
    if (slot) slots[slot].push(card);
    else otherEquipment.push(card);
  }

  const maindeck = (categories.maindeck ?? []).map(shapeCard);
  const inventory = (categories.inventory ?? []).map(shapeCard);
  const benched = (categories.benched ?? []).map(shapeCard);
  const tokens = (categories.tokens ?? []).map(shapeCard);

  const stats = computeStats(maindeck);

  const meta = {
    name: deck.name,
    heroName: deck.heroName ?? null,
    heroDisplay: deck.heroName ?? null,
    className: heroCard?.classes?.[0] ?? null,
    talents: heroCard?.talents ?? [],
    format: deck.format ?? null,
    publicId: deck.publicId,
    description: deck.description ?? null,
    event: deck.eventName ?? null,
    eventDate: deck.eventDate ?? null,
    placing: deck.placing ?? null,
    totalCards: deck.totalCards ?? stats.totalCards,
    maindeckCount: stats.totalCards,
    estimatedValue: raw.estimatedValue ?? deck.estimatedValue ?? 0,
  };

  const matchupsRaw: any[] = Array.isArray(deck.metadata?.matchups) ? deck.metadata.matchups : [];
  const matchups = matchupsRaw.map((m) => ({
    heroId: m.heroId,
    heroDisplay: humanizeHeroId(m.heroId ?? ''),
    turnOrder: m.preferredTurnOrder ?? null,
    notes: m.notes ?? null,
    sideboard: {
      in: Array.isArray(m.sideboard?.in) ? m.sideboard.in : [],
      out: Array.isArray(m.sideboard?.out) ? m.sideboard.out : [],
    },
  }));

  const url = deck.publicId ? `https://fabbazaar.app/decks/${deck.publicId}` : undefined;
  const subtitleParts: string[] = [];
  if (meta.heroDisplay) subtitleParts.push(meta.heroDisplay);
  if (meta.format) subtitleParts.push(meta.format);
  subtitleParts.push(`${meta.totalCards} cards`);
  const subtitle = subtitleParts.join(' · ');

  const shaped = {
    meta,
    heroCard,
    weapon,
    equipment: { ...slots, other: otherEquipment },
    categories: { maindeck, inventory, benched, tokens },
    stats,
    matchups,
  };

  const text = buildDeckText(deck, shaped, showDetails);

  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      title: deck.name ?? 'Deck',
      subtitle,
      url,
      deck: shaped,
      tool: deck.name ? { name: 'get_deck', baseArgs: { deckName: deck.name } } : undefined,
    },
  };
}
