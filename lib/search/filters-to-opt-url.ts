/**
 * Canonical PrintingsSearchFilters → /opt deep-link params (hybrid search,
 * Bridge A: "chat shows its work"). When an AI/MCP search runs, the tool emits
 * an /opt URL alongside the results; opening it hydrates the SAME filters as
 * editable chips (param names must match lib/search/opt-url-state.ts).
 *
 * Deliberately partial: only fields with a clean /opt chip equivalent are
 * mapped. Hero-legality expansions (heroClasses/heroTalents/heroEssences),
 * negation fields (setsNot, …), and boolean flag families have no chip
 * representation and are silently skipped — the link is a starting point for
 * manual refinement, not a lossless round-trip.
 *
 * Pure + framework-free.
 */

import { TYPE_CHIPS } from './card-filter-chips';

// apiType ("defense reaction") → chip slug ("defense-reaction") — the /opt
// type param carries the CHIP value, not the DB type token.
const CHIP_BY_API_TYPE = new Map(TYPE_CHIPS.map((c) => [c.apiType, c.value]));

// Boolean type-flag filters (bare type-phrase searches) → apiType.
const FLAG_TO_API_TYPE: Array<[string, string]> = [
  ['isDefenseReaction', 'defense reaction'],
  ['isAttack', 'attack'],
  ['isAction', 'action'],
  ['isInstant', 'instant'],
  ['isEquipment', 'equipment'],
  ['isWeapon', 'weapon'],
];

const COLOR_TO_PITCH: Record<string, number> = { red: 1, yellow: 2, blue: 3 };

const csv = (a: unknown): string | null =>
  Array.isArray(a) && a.length > 0 ? a.map(String).join(',') : null;

const num = (v: unknown): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? String(v) : null;

export function filtersToOptParams(filters: Record<string, unknown>): URLSearchParams {
  const p = new URLSearchParams();

  // Query text: name search is /opt's default mode; text search sets mode=text.
  if (typeof filters.name === 'string' && filters.name.trim()) {
    p.set('q', filters.name.trim());
  } else if (typeof filters.text === 'string' && filters.text.trim()) {
    p.set('q', filters.text.trim());
    p.set('mode', 'text');
  }

  // /opt has a single-type chip; only an unambiguous single type maps.
  // Chip params carry the chip slug, so normalize the apiType through
  // TYPE_CHIPS ("defense reaction" → "defense-reaction").
  if (Array.isArray(filters.types) && filters.types.length === 1) {
    const t = String(filters.types[0]);
    p.set('type', CHIP_BY_API_TYPE.get(t) ?? t);
  } else {
    // Boolean type flags from bare type-phrase searches ("defense reactions").
    const flag = FLAG_TO_API_TYPE.find(([key]) => filters[key] === true);
    const chip = flag ? CHIP_BY_API_TYPE.get(flag[1]) : undefined;
    if (chip) p.set('type', chip);
  }

  const csvParams: Array<[string, unknown]> = [
    ['classes', filters.classes],
    ['talents', filters.talents],
    ['keywords', filters.keywords],
    ['rarities', filters.rarities],
    ['foilings', filters.foilings],
    ['editions', filters.editions],
    ['sets', filters.sets],
    ['heroAge', filters.heroAges],
  ];
  for (const [key, value] of csvParams) {
    const v = csv(value);
    if (v) p.set(key, v);
  }

  // Explicit pitch wins (single number or multi-select array); a bare color
  // word (red/yellow/blue) maps to the same pitch chip otherwise.
  const pitch = (Array.isArray(filters.pitch) ? csv(filters.pitch.filter((v) => typeof v === 'number')) : null)
    ?? num(filters.pitch)
    ?? (typeof filters.color === 'string' ? num(COLOR_TO_PITCH[filters.color]) : null);
  if (pitch) p.set('pitch', pitch);
  if (typeof filters.format === 'string' && filters.format) p.set('format', filters.format);

  // Curated function tags → the /opt 'tags' param (facetTags filter ↔ selectedFacets
  // chips). facetTagsMode 'all' becomes tagsAll=1, but only with tags selected.
  const tags = csv(filters.facetTags);
  if (tags) {
    p.set('tags', tags);
    if (filters.facetTagsMode === 'all') p.set('tagsAll', '1');
  }

  const rangeParams: Array<[string, unknown]> = [
    ['costMin', filters.costMin], ['costMax', filters.costMax],
    ['powerMin', filters.powerMin], ['powerMax', filters.powerMax],
    ['defMin', filters.defenseMin], ['defMax', filters.defenseMax],
    ['arcMin', filters.arcaneMin], ['arcMax', filters.arcaneMax],
    ['healthMin', filters.healthMin], ['healthMax', filters.healthMax],
    ['priceMin', filters.priceMin], ['priceMax', filters.priceMax],
  ];
  for (const [key, value] of rangeParams) {
    const v = num(value);
    if (v) p.set(key, v);
  }

  return p;
}

/** Absolute /opt URL for the given filters; bare /opt when nothing maps. */
export function buildOptSearchUrl(filters: Record<string, unknown>, baseUrl: string): string {
  const params = filtersToOptParams(filters).toString();
  return `${baseUrl.replace(/\/$/, '')}/opt${params ? `?${params}` : ''}`;
}
