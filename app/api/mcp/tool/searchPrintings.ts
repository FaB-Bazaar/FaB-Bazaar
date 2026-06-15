// app/api/mcp/tool/searchPrintings.ts
import { printingsService } from '@/lib/services';
import { FABShorthandParser } from '@/lib/fab-shorthand-parser';
import { getHeroInfo, validateHeroFormatLegality } from '@/lib/fab-constants/heroes';
import { sortPrintings, normalizeSetCode } from '@/lib/fab-constants/sets';
import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

const shorthandParser = new FABShorthandParser();

const FOILING_DISPLAY: Record<string, string> = {
  s: 'Non-foil', r: 'Rainbow Foil', c: 'Cold Foil', g: 'Gold Foil',
};
const EDITION_DISPLAY: Record<string, string> = {
  n: 'Normal', f: 'First Edition', u: 'Unlimited', a: 'Alpha',
};
const RARITY_DISPLAY: Record<string, string> = {
  c: 'Common', r: 'Rare', s: 'Super Rare', m: 'Majestic',
  l: 'Legendary', f: 'Fabled', t: 'Token', p: 'Promo', v: 'Marvel',
};
const COLOR_TO_PITCH: Record<string, number> = { red: 1, yellow: 2, blue: 3 };

// Compact projection for MCP clients — keeps only fields needed to act on a
// printing (add to binder/wants/deck/list, display to user, who_has). Drops
// ~40 redundant booleans/metadata fields per printing to save tokens.
type PriceField = 'tcg_low' | 'tcg_mid' | 'tcg_high' | 'tcg_market';
const VALID_PRICE_FIELDS = new Set<string>(['tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market']);
function resolvePriceField(f?: string): PriceField { return f && VALID_PRICE_FIELDS.has(f) ? f as PriceField : 'tcg_low'; }
type ProjectOptions = { includeImage?: boolean; includeArtists?: boolean; includeText?: boolean; priceField?: PriceField };

function formatPrinting(p: any, opts: ProjectOptions = {}): string {
  const lines = [
    `• ${p.display_name || p.name || 'Unknown'} (${p.collector_number || 'N/A'})`,
    `    Printing ID: ${p.printing_id}`,
    `    Card Unique ID: ${p.card_unique_id}`,
    `    Set: ${(p.set || '?').toUpperCase()} | ${EDITION_DISPLAY[p.edition] || p.edition || '?'} | ${FOILING_DISPLAY[p.foiling] || p.foiling || '?'}`,
    `    Rarity: ${RARITY_DISPLAY[p.rarity] || p.rarity || '?'} | Price: ${(() => { const v = p[resolvePriceField(opts.priceField)]; return v ? `$${v.toFixed(2)}` : 'N/A'; })()}`,
    `    Types: ${Array.isArray(p.types) && p.types.length > 0 ? p.types.join(', ') : '—'}`,
  ];
  if (opts.includeImage && p.image_url) lines.push(`    Image: ${p.image_url}`);
  if (opts.includeArtists && Array.isArray(p.artists) && p.artists.length > 0) {
    lines.push(`    Artists: ${p.artists.join(', ')}`);
  }
  if (opts.includeText && p.text) {
    const text = String(p.text).replace(/\s+/g, ' ').trim();
    lines.push(`    Text: ${text}`);
  }
  return lines.join('\n');
}
type SectionInput = {
  index: number;
  query: string;
  total: number;
  printings: any[];
  foilingFallback?: boolean;
};

const MAX_SECTION_GROUPS = 10;
const MAX_TAIL_PRINTINGS = 8;

export function formatSearchSections(output: SectionInput[], projectOpts: ProjectOptions = {}): string[] {
  return output.map(r => {
    const label = r.query;
    if (r.printings.length === 0) {
      return `🔍 **${label}** — no results`;
    }

    const groupsMap = new Map<string, any[]>();
    for (const p of r.printings) {
      const key = p.card_unique_id ?? p.name ?? p.printing_id;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(p);
    }
    const groups = [...groupsMap.values()];

    const fallbackNote = r.foilingFallback
      ? '\n  ⚠️ No non-foil printing exists — showing available foil printing(s) instead'
      : '';

    const shown = groups.slice(0, MAX_SECTION_GROUPS);
    const moreCards = groups.length > MAX_SECTION_GROUPS
      ? `\n  …and ${groups.length - MAX_SECTION_GROUPS} more distinct cards`
      : '';

    const body = shown.map(group => {
      const sorted = sortPrintings(group);
      const best = sorted[0];
      const others = sorted.slice(1);
      if (others.length === 0) return formatPrinting(best, projectOpts);
      // Enumerate the hidden printings as SET·edition·foiling·price so the client
      // can SEE the other versions (and their sets) without a second query — the
      // representative is just the earliest-released set, NOT necessarily the
      // one the user means. Collapse near-identical printings (e.g. the same
      // set/edition/foiling across languages) into one TOKEN ×count entry so the
      // list stays scannable; distinct sets/foilings each get their own entry.
      const tokenCounts = new Map<string, { count: number; price?: number }>();
      for (const p of others) {
        const set = (p.set || '?').toUpperCase();
        const ed = p.edition || 'n';
        const fo = p.foiling || 's';
        const ea = p.is_extended_art ? '·EA' : '';
        const key = `${set}·${ed}·${fo}${ea}`;
        const price = p[resolvePriceField(projectOpts.priceField)];
        const cur = tokenCounts.get(key);
        if (cur) { cur.count++; if (cur.price == null && price) cur.price = price; }
        else tokenCounts.set(key, { count: 1, price: price ?? undefined });
      }
      const shownOthers = [...tokenCounts.entries()].slice(0, MAX_TAIL_PRINTINGS).map(([k, v]) =>
        `${k}${v.price ? ` $${v.price.toFixed(2)}` : ''}${v.count > 1 ? ` ×${v.count}` : ''}`
      );
      const overflow = tokenCounts.size > MAX_TAIL_PRINTINGS ? `, +${tokenCounts.size - MAX_TAIL_PRINTINGS} more` : '';
      const tail = `\n    +${others.length} more printing${others.length !== 1 ? 's' : ''} of this card: ${shownOthers.join(', ')}${overflow}`;
      return `${formatPrinting(best, projectOpts)}${tail}`;
    }).join('\n');

    const cardsLine = groups.length > 1
      ? ` across ${groups.length} cards`
      : '';

    return `🔍 **${label}** — ${r.total} printing${r.total !== 1 ? 's' : ''}${cardsLine}${fallbackNote}\n${body}${moreCards}`;
  });
}

function projectPrintingForMcp(p: any, opts: ProjectOptions = {}): any {
  if (!p) return p;
  const out: any = {
    printing_id: p.printing_id,
    card_unique_id: p.card_unique_id,
    collector_number: p.collector_number || null,
    name: p.display_name || p.name,
    set: p.set,
    edition: p.edition,
    foiling: p.foiling,
    rarity: p.rarity,
    pitch: p.pitch ?? null,
    color: p.color || null,
    types: Array.isArray(p.types) ? p.types : [],
    price: p[resolvePriceField(opts.priceField)] ?? null,
  };
  if (p.is_extended_art) out.ea = true;
  if (Array.isArray(p.art_variations) && p.art_variations.length > 0) out.art = p.art_variations;
  if (opts.includeImage && p.image_url) out.image_url = p.image_url;
  if (opts.includeArtists && Array.isArray(p.artists) && p.artists.length > 0) out.artists = p.artists;
  if (opts.includeText && p.text) out.text = p.text;
  return out;
}

function convertMCPFilters(mcpFilters: any): PrintingsSearchFilters {
  const f: PrintingsSearchFilters = {};

  if (mcpFilters.name)             f.name             = mcpFilters.name;
  if (mcpFilters.text)             f.text             = mcpFilters.text;
  if (mcpFilters.searchableText)   f.searchableText   = mcpFilters.searchableText;
  // Default exact=true when a name is provided — prevents fuzzy matching from returning wrong cards.
  // The client can explicitly pass exact: false to opt into fuzzy/typo-tolerant matching.
  if (mcpFilters.exact != null)    f.exact            = mcpFilters.exact;
  else if (mcpFilters.name)        f.exact            = true;

  if (mcpFilters.collectorNumber) {
    f.collectorNumber = typeof mcpFilters.collectorNumber === 'string' && mcpFilters.collectorNumber.includes(',')
      ? mcpFilters.collectorNumber.split(',').map((s: string) => s.trim())
      : mcpFilters.collectorNumber;
  }
  if (mcpFilters.printingIds) {
    f.printingIds = typeof mcpFilters.printingIds === 'string'
      ? mcpFilters.printingIds.split(',').map((s: string) => s.trim())
      : mcpFilters.printingIds;
  }
  if (mcpFilters.cardUniqueId)  f.cardUniqueId  = mcpFilters.cardUniqueId;
  if (mcpFilters.cardUniqueIds) f.cardUniqueIds = mcpFilters.cardUniqueIds;

  const passThrough = [
    'sets', 'types', 'classes', 'talents', 'talentsAll', 'rarities', 'foilings',
    'editions', 'color', 'traits', 'keywords', 'artists',
    'power', 'powerMin', 'powerMax', 'powerNot',
    'cost', 'costs', 'costMin', 'costMax', 'costNot',
    'defense', 'defenseMin', 'defenseMax', 'defenseNot',
    'pitch', 'priceMin', 'priceMax', 'priceField',
    'heroClasses', 'heroTalents', 'heroEssences', 'excludeClasses', 'excludeTalents',
    'format', 'includeBanned', 'includeSuspended',
    'colorNot', 'raritiesNot', 'setsNot', 'foilingsNot', 'editionsNot',
    'typesNot', 'classesNot', 'keywordsNot', 'textNot', 'talentsNot',
    'isAction', 'isAttack', 'isDefenseReaction', 'isInstant', 'isEquipment',
    'isWeapon', 'isHero', 'isMentor', 'isToken',
    'isGeneric', 'isBrute', 'isGuardian', 'isMechanologist', 'isRanger',
    'isRuneblade', 'isAssassin', 'isWarrior', 'isNinja', 'isWizard',
    'isMerchant', 'isBard', 'isAdjudicator', 'isIllusionist', 'isThief',
    'isShapeshifter', 'isNecromancer',
    'hasChaos', 'hasLight', 'hasRoyal', 'hasDraconic', 'hasLightning',
    'hasShadow', 'hasEarth', 'hasMystic', 'hasRevered', 'hasIce',
    'hasReviled', 'hasPirate', 'hasElemental',
    'isGenericOnly', 'hasClassAndTalent', 'hasClassOnly', 'hasTalentOnly',
    'isExtendedArt', 'artVariations',
    'isFirstEdition', 'isUnlimited', 'isNormalEdition',
    'isNormalFoil', 'isRainbowFoil', 'isColdFoil',
    'isCommon', 'isRare', 'isSuperRare', 'isMajestic', 'isLegendary',
    'isFabled', 'isPromo', 'isBudget', 'isUnder5', 'isUnder10', 'isUnder25',
    'isUnder50', 'isUnder100', 'isExpensive', 'isPremium', 'hasProductId',
  ];
  passThrough.forEach(k => { if (mcpFilters[k] != null) (f as any)[k] = mcpFilters[k]; });

  // Normalize set codes so legacy/community spellings resolve (hp1 → 1hp).
  // Covers the structured path; the shorthand parser normalizes its own tokens.
  if (Array.isArray(f.sets)) f.sets = f.sets.map(normalizeSetCode);
  if (Array.isArray((f as any).setsNot)) (f as any).setsNot = (f as any).setsNot.map(normalizeSetCode);

  // heroLegal → resolve to heroClasses + heroTalents + heroEssences for precise filtering
  if (mcpFilters.heroLegal) {
    const names = Array.isArray(mcpFilters.heroLegal) ? mcpFilters.heroLegal : [mcpFilters.heroLegal];
    const allClasses = new Set<string>();
    const allTalents = new Set<string>();
    const allEssences = new Set<string>();
    let usedLegacy = false;
    for (const name of names) {
      const info = getHeroInfo(name);
      if (info) {
        info.classes.forEach((c: string) => allClasses.add(c));
        info.talents.forEach((t: string) => allTalents.add(t));
        (info.essences ?? []).forEach((e: string) => allEssences.add(e));
      } else {
        f.heroLegal = mcpFilters.heroLegal;
        usedLegacy = true;
      }
    }
    if (!usedLegacy && (allClasses.size > 0 || allTalents.size > 0 || allEssences.size > 0)) {
      (f as any).heroClasses = [...allClasses];
      (f as any).heroTalents = [...allTalents];
      if (allEssences.size > 0) (f as any).heroEssences = [...allEssences];
    }
  }

  return f;
}

/**
 * Resolve a single card descriptor (query string or filters object) to a
 * PrintingsSearchFilters object, plus a hint whether it's simple enough for
 * the bulk path (name + optional pitch, no other constraints).
 */
function resolveCardFilters(card: { query?: string; filters?: any }): {
  filters: PrintingsSearchFilters;
  isSimple: boolean;
  simpleName?: string;
  simplePitch?: number;
} {
  let filters: PrintingsSearchFilters = {};

  if (card.query?.trim()) {
    try {
      filters = shorthandParser.parseQuery(card.query.trim()).filters;
    } catch {
      filters = { name: card.query.trim() };
    }
  }

  if (card.filters && Object.keys(card.filters).length > 0) {
    filters = { ...filters, ...convertMCPFilters(card.filters) };
  }

  // Determine if this is a simple name+pitch lookup (eligible for bulk path)
  const keys = Object.keys(filters).filter(k => (filters as any)[k] != null);
  const simpleKeys = new Set(['name', 'exact', 'pitch', 'color']);
  const isSimple =
    !!filters.name &&
    filters.exact !== false &&
    keys.every(k => simpleKeys.has(k));

  const pitch = filters.pitch != null
    ? (Array.isArray(filters.pitch) ? undefined : (filters.pitch as number))
    : (filters.color ? COLOR_TO_PITCH[filters.color] : undefined);

  return {
    filters,
    isSimple,
    simpleName: isSimple ? filters.name : undefined,
    simplePitch: isSimple ? pitch : undefined,
  };
}

export const searchPrintingsTool = {
  name: 'search_printings',
  description: `🔍 PRIMARY CARD SEARCH TOOL — find cards, look up printings, discover card versions, harvest IDs.

Use this for ANY card lookup: by name, by set, by rarity, by price, by hero legality, by keyword, by type.
This is the tool for queries like: "find Command and Conquer red", "look up Pummel printings", "what equipment does Dash play", "show me cheap Majestics", "search for Enlightened Strike", "any blue attacks under $5".

Results are returned in a compact projection — each printing includes printing_id, card_unique_id, collector_number, name, set, edition, foiling, rarity, pitch, color, types[], price, and (when present) ea / art. Set options.includeImage/includeArtists/includeText to opt into extra fields.

⚠️ DISAMBIGUATING PRINTINGS: the text view collapses to ONE representative printing per card (the earliest-released set), then a "+N more printings of this card:" line enumerates the others as SET·edition·foiling·price. The representative is NOT necessarily the user's copy — do NOT assume it's WTR/the oldest set. To pin a specific printing, pass sets[] / foilings[] / editions[] (e.g. foilings:["r"] for Rainbow Foil, sets:["1hp"] for the History Pack reprint). The full per-printing list is also returned in structuredContent for clients that read it.

Always pass ALL cards you need in one call — never loop.

Each entry in \`cards\` uses either a shorthand query string or a structured filters object:

Option A — shorthand query (best for trade posts):
  Standalone tokens parsed automatically: rf cf nf gf ea alpha unlimited 1st red yellow blue
  Prefixed tokens: foil:rf set:wtr edition:alpha color:red r:m t:equipment hero:gravy p:<25
  Card name expansions: cnc aow es cheeto ooh cata (see fab://constants for full list)

  Examples:
    "rf warrior's valor blue"           → RF + pitch 3
    "cf ea timesnap potion"             → CF + Extended Art
    "nf enlightened strike set:pen"     → NF + PEN set
    "alpha cnc"                         → Alpha Command and Conquer
    "cheeto cf"                         → CF Kayo, Underhanded Cheat
    "hero:gravy r:m p:<50"              → Majestic cards legal for Gravy under $50

Option B — filters object (best for programmatic/precise queries):
  { name: "Pummel", exact: true, foilings: ["r"], pitch: 1 }
  { isEquipment: true, heroLegal: "dash", priceMax: 20 }
  { name: "Warrior's Valor", foilings: ["c"], artVariations: ["FA"] }

Fallback when exact match returns 0 results:
  1. Drop isExtendedArt/artVariations, retry exact: true
  2. Switch to exact: false — inspect returned name for correct spelling (hyphens, plurals)
  3. Drop all filters except name with exact: false to confirm the card exists at all

Marvel disambiguation:
  rarities: ["v"] = actual Marvel rarity
  foilings: ["c"] + artVariations: ["FA"] = Full Art CF promos (also called "Marvel" by community)
  → Fire both in parallel when unsure

Examples:
search_printings({ cards: [{ query: "pummel red" }, { query: "pummel yellow" }, { query: "sink below blue" }] })
search_printings({ cards: [{ filters: { isEquipment: true, heroLegal: "dash", priceMax: 30 } }], options: { limit: 20 } })
search_printings({ cards: [{ query: "rf cnc" }, { query: "cf cheeto" }, { query: "nf es set:pen" }] })`,

  parameters: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        minItems: 1,
        description: 'One entry per card. Batch everything — never call in a loop.',
        items: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Shorthand query string. e.g. "pummel red", "rf cnc wtr alpha", "hero:gravy r:m".',
            },
            filters: {
              type: 'object',
              description: 'Structured filters. name, exact, text, searchableText, collectorNumber, printingIds, cardUniqueId, sets[], types[], classes[], talents[], keywords[], traits[], color, pitch, power/Min/Max, cost/Min/Max, defense/Min/Max, rarities[], foilings[], editions[], artists[], priceMin/Max, priceField, heroLegal, heroClasses[], heroTalents[], heroEssences[], excludeClasses[], excludeTalents[], format, includeBanned, includeSuspended. Negation: setsNot[], typesNot[], raritiesNot[], foilingsNot[], editionsNot[], colorNot[], classesNot[], keywordsNot[], textNot, talentsNot[]. Printing-differentiating booleans: isFirstEdition, isUnlimited, isNormalEdition, isNormalFoil, isRainbowFoil, isColdFoil, isExtendedArt, artVariations[], hasProductId.',
              properties: {
                name:             { type: 'string', description: 'Card name. Defaults to exact matching when provided — set exact: false only for fuzzy/typo-tolerant search.' },
                exact:            { type: 'boolean', description: 'Default: true when name is set. Set false to enable fuzzy/similarity matching.' },
                searchableText:   { type: 'string', description: 'Broad search across all text fields. Use for discovery when exact card name is unknown.' },
                color:            { type: 'string', enum: ['red', 'yellow', 'blue'] },
                pitch:            { type: ['number', 'array'], description: '1=red, 2=yellow, 3=blue' },
                rarities:         { type: 'array', items: { type: 'string', enum: ['c','r','s','m','l','f','t','p','v'] }, description: 'c=Common r=Rare s=SuperRare m=Majestic l=Legendary f=Fabled t=Token p=Promo v=Marvel' },
                foilings:         { type: 'array', items: { type: 'string', enum: ['s','r','c','g'] }, description: 's=NonFoil r=RainbowFoil c=ColdFoil g=GoldFoil' },
                editions:         { type: 'array', items: { type: 'string', enum: ['a','f','u','n'] }, description: 'a=Alpha f=FirstEdition u=Unlimited n=Normal' },
                format:           { type: 'string', enum: ['blitz', 'cc', 'commoner', 'll', 'silver_age'] },
                heroLegal:        { type: 'string', description: 'Hero name — returns cards legal for that hero' },
                priceMin:         { type: 'number' },
                priceMax:         { type: 'number' },
                priceField:       { type: 'string', enum: ['tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market'] },
              },
              additionalProperties: true,
            },
          },
        },
      },
      options: {
        type: 'object',
        description: 'Pagination/sort and optional extra fields per printing.',
        properties: {
          limit:     { type: 'number', default: 12, minimum: 1, maximum: 100 },
          page:      { type: 'number', default: 1, minimum: 1 },
          sortBy:    { type: 'string', enum: ['name', 'price', 'power', 'cost', 'defense', 'set', 'rarity', 'collector_number', 'color', 'foiling', 'edition', 'relevance'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          includeImage:   { type: 'boolean', description: 'Include image_url per printing. Default false.' },
          includeArtists: { type: 'boolean', description: 'Include artists[] per printing. Default false.' },
          includeText:    { type: 'boolean', description: 'Include card text per printing. Default false.' },
        },
      },
    },
    required: ['cards'],
  },

  async handler(input: { cards?: Array<{ query?: string; filters?: any }>; options?: any; [key: string]: any }) {
    const startTime = Date.now();

    // Backward-compat: old clients send { filters: {}, options: {} } at the top level.
    // Wrap into the current cards[] format so the rest of the handler is unchanged.
    let { cards, options = {} } = input;
    if (!cards && (input.filters || input.query)) {
      cards = [{ query: input.query, filters: input.filters }];
    }
    if (!cards?.length) {
      return { success: false, message: 'cards array is required. Use: { cards: [{ query: "pummel red" }] }' };
    }

    // Resolve each card to filters + simple/complex classification
    const resolved = cards.map(resolveCardFilters);

    // Guardrail: when heroLegal + format are both set, the hero must be the right
    // age for that format (Silver Age / Blitz / Commoner = young; CC / LL = adult).
    // We read the user-facing inputs (cards[i].filters) since heroLegal is rewritten
    // to heroClasses/heroTalents inside resolveCardFilters.
    for (let i = 0; i < cards.length; i++) {
      const userFilters = cards[i].filters;
      if (!userFilters?.heroLegal || !userFilters?.format) continue;
      const names = Array.isArray(userFilters.heroLegal) ? userFilters.heroLegal : [userFilters.heroLegal];
      for (const name of names) {
        const check = validateHeroFormatLegality(name, userFilters.format);
        if (!check.ok) {
          return { success: false, message: check.error };
        }
      }
    }

    // ── Tier 1: simple name+pitch cards → one bulkResolveByName query ─────────
    const simpleIndices = resolved
      .map((r, i) => (r.isSimple && r.simpleName ? i : -1))
      .filter(i => i >= 0);

    const complexIndices = resolved
      .map((r, i) => (!r.isSimple ? i : -1))
      .filter(i => i >= 0);

    const bulkInputs = simpleIndices.map(i => ({
      name: resolved[i].simpleName!,
      pitch: resolved[i].simplePitch,
    }));

    const [bulkResult, ...complexResults] = await Promise.all([
      bulkInputs.length > 0
        ? printingsService.bulkResolveByName(bulkInputs)
        : Promise.resolve({ success: true as const, data: [] as any[] }),
      ...complexIndices.map(i =>
        printingsService.searchPrintings(resolved[i].filters, {
          limit: options.limit || 12,
          page: options.page || 1,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        })
      ),
    ]);

    // ── Assemble output ───────────────────────────────────────────────────────
    const output: Array<{ index: number; query: string; printings: any[]; total: number }> = [];

    simpleIndices.forEach((originalIdx, bulkIdx) => {
      if (!bulkResult.success) {
        output.push({ index: originalIdx, query: cards[originalIdx].query || JSON.stringify(cards[originalIdx].filters), printings: [], total: 0 });
        return;
      }
      const entry = bulkResult.data[bulkIdx];
      const printings = entry?.printings ?? [];
      output.push({
        index: originalIdx,
        query: cards[originalIdx].query || resolved[originalIdx].simpleName!,
        printings,
        total: printings.length,
      });
    });

    complexIndices.forEach((originalIdx, complexIdx) => {
      const res = complexResults[complexIdx];
      const printings = res.success ? (res.data?.printings ?? []) : [];
      output.push({
        index: originalIdx,
        query: cards[originalIdx].query || JSON.stringify(cards[originalIdx].filters),
        printings,
        total: res.success ? (res.data?.total ?? printings.length) : 0,
      });
    });

    // Sort back to original input order
    output.sort((a, b) => a.index - b.index);

    // ── Foiling fallback ──────────────────────────────────────────────────────
    // Some cards (Legendary, Promo) are printed in foil only and return 0
    // results when foilings: ["s"] is applied. Retry those without the foiling
    // filter so the client always gets a result, with a note that NF doesn't exist.
    const foilingFallbackItems = output
      .filter(r => r.total === 0 && resolved[r.index].filters.foilings?.length);

    if (foilingFallbackItems.length > 0) {
      const fallbackResults = await Promise.all(
        foilingFallbackItems.map(r => {
          const { foilings: _f, foilingsNot: _fn, ...noFoilFilter } = resolved[r.index].filters as any;
          return printingsService.searchPrintings(noFoilFilter, {
            limit: options.limit || 12,
            sortBy: options.sortBy,
            sortOrder: options.sortOrder,
          });
        })
      );
      foilingFallbackItems.forEach((r, i) => {
        const res = fallbackResults[i];
        if (res.success && res.data.total > 0) {
          r.printings = res.data.printings;
          r.total = res.data.total;
          (r as any).foilingFallback = true;
        }
      });
    }

    const duration = Date.now() - startTime;
    const totalFound = output.reduce((sum, r) => sum + r.total, 0);
    const dbPath = simpleIndices.length > 0 && complexIndices.length === 0
      ? '1 bulk query'
      : simpleIndices.length > 0
        ? `1 bulk query + ${complexIndices.length} parallel query${complexIndices.length > 1 ? 's' : ''}`
        : `${complexIndices.length} parallel query${complexIndices.length > 1 ? 's' : ''}`;

    const firstPriceField = cards.find(c => c.filters?.priceField)?.filters?.priceField as PriceField | undefined;
    const projectOpts: ProjectOptions = {
      includeImage: !!options.includeImage,
      includeArtists: !!options.includeArtists,
      includeText: !!options.includeText,
      priceField: firstPriceField,
    };

    const sections = formatSearchSections(output, projectOpts);

    return {
      success: true,
      message: `Found ${totalFound} result${totalFound !== 1 ? 's' : ''} across ${cards.length} card${cards.length !== 1 ? 's' : ''} (${dbPath}, ${duration}ms)\n\n${sections.join('\n\n')}`,
      results: output.map(r => {
        const sorted = r.printings.length > 0 ? sortPrintings(r.printings) : [];
        const cardPriceField = cards[r.index]?.filters?.priceField as PriceField | undefined;
        const opts = cardPriceField ? { ...projectOpts, priceField: cardPriceField } : projectOpts;
        return {
          index: r.index,
          query: r.query,
          total: r.total,
          printings: r.printings.map(p => projectPrintingForMcp(p, opts)),
          bestPrinting: sorted.length > 0 ? projectPrintingForMcp(sorted[0], opts) : null,
          foilingFallback: (r as any).foilingFallback ?? false,
        };
      }),
    };
  },
};
