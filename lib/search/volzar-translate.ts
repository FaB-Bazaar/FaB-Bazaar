/**
 * Volzar scope on /opt — plain English → structured /opt state.
 *
 * The route asks the LLM for ONE JSON object in the PrintingsSearchFilters
 * shape (the same schema the MCP search_printings tool uses, so the model has
 * seen it before). This module is the pure half:
 *   - buildTranslateSystemPrompt: the instruction + the REAL vocabulary
 *     (classes, talents, keywords, types, codes) so there is nothing to guess.
 *   - parseTranslation: pull the JSON out of the reply and sanitise it against
 *     that vocabulary — a hallucinated class or keyword never reaches search.
 *   - translationToOptState: filters → OptUiState patch via the existing
 *     filters→/opt mapper (chips + query + scope), resetting every filter it
 *     doesn't set so a new question replaces the previous chips.
 */

import { KEYWORDS } from '@/lib/fab-constants/keywords';
import { CARD_FILTER_SETS, normalizeSetCode } from '@/lib/fab-constants/sets';
import { resolveHeroShorthand } from '@/lib/fab-constants/heroes';
import { ALL_CLASSES, ALL_TALENTS, TYPE_CHIPS, RARITY_OPTIONS, FOILING_OPTIONS, EDITION_OPTIONS } from './card-filter-chips';
import { filtersToOptParams } from './filters-to-opt-url';
import { DEFAULT_OPT_STATE, paramsToUiState, type OptUiState } from './opt-url-state';

const FORMATS = ['cc', 'future_cc', 'blitz', 'commoner', 'll', 'silver_age'] as const;
const COLORS = ['red', 'yellow', 'blue'] as const;
const NUMERIC_KEYS = ['costMin', 'costMax', 'powerMin', 'powerMax', 'defenseMin', 'defenseMax',
  'arcaneMin', 'arcaneMax', 'healthMin', 'healthMax', 'priceMin', 'priceMax'] as const;

const lc = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const pickList = (v: unknown, allowed: ReadonlySet<string>, map: (s: string) => string = lc): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.map(map).filter((s) => s && allowed.has(s)))];
  return out.length ? out : undefined;
};

const CLASS_SET = new Set<string>(ALL_CLASSES);
const TALENT_SET = new Set<string>(ALL_TALENTS.map((t) => t.toLowerCase()));
const KEYWORD_SET = new Set<string>(KEYWORDS.map((k) => k.toLowerCase()));
const TYPE_SET = new Set<string>(TYPE_CHIPS.map((c) => c.apiType));
const RARITY_SET = new Set<string>(RARITY_OPTIONS.map((r) => r.value));
const FOILING_SET = new Set<string>(FOILING_OPTIONS.map((f) => f.value));
const EDITION_SET = new Set<string>(EDITION_OPTIONS.map((e) => e.value));
const SET_SET = new Set<string>(CARD_FILTER_SETS);
const FORMAT_SET = new Set<string>(FORMATS);

export type Translation = Record<string, unknown>;

export interface FacetTagVocab { id: string; label: string; def?: string | null }

/**
 * How FaB card text actually phrases the mechanics people ask for. `text` is a
 * substring match on rules text, so the model must emit the printed template
 * ("When this hits …") rather than the player's paraphrase ("on hit effect"
 * matched nothing). Every phrase below was checked against the DB.
 */
export const RULES_TEXT_PHRASINGS: ReadonlyArray<[ask: string, text: string]> = [
  ['on hit / on-hit effect / when it hits', 'when this hits'],
  ['on block / when it defends / block effect', 'when this defends'],
  ['arcane / deals arcane damage', 'arcane damage'],
  ['draws / card draw', 'draw a card'],
  ['prevents damage', 'prevent'],
  ['recursion / gets cards back from the graveyard', 'from your graveyard'],
  ['banishes / plays from banished zone', 'banish'],
  ['makes tokens', 'create a'],
  ['buffs the next attack', 'the next time'],
];

/** Extract + sanitise the model's JSON. null when no object can be found. */
export function parseTranslation(raw: string, opts: { facetTagIds?: ReadonlySet<string> } = {}): Translation | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try { obj = JSON.parse(fenced.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const f = obj as Record<string, unknown>;
  const out: Translation = {};

  if (typeof f.name === 'string' && f.name.trim()) out.name = f.name.trim();
  if (typeof f.text === 'string' && f.text.trim()) out.text = f.text.trim();
  const classes = pickList(f.classes, CLASS_SET); if (classes) out.classes = classes;
  const talents = pickList(f.talents, TALENT_SET); if (talents) out.talents = talents;
  const keywords = pickList(f.keywords, KEYWORD_SET); if (keywords) out.keywords = keywords;
  const types = pickList(f.types, TYPE_SET); if (types) out.types = types;
  const rarities = pickList(f.rarities, RARITY_SET); if (rarities) out.rarities = rarities;
  const foilings = pickList(f.foilings, FOILING_SET); if (foilings) out.foilings = foilings;
  const editions = pickList(f.editions, EDITION_SET); if (editions) out.editions = editions;
  const sets = pickList(f.sets, SET_SET, (s) => normalizeSetCode(lc(s))); if (sets) out.sets = sets;
  const heroAges = pickList(f.heroAges, new Set(['adult', 'young'])); if (heroAges) out.heroAges = heroAges;
  const pitchIn = Array.isArray(f.pitch) ? f.pitch : [f.pitch];
  const pitch = pitchIn.filter((p): p is number => typeof p === 'number' && [1, 2, 3].includes(p));
  if (pitch.length) out.pitch = pitch.length === 1 ? pitch[0] : pitch;
  const color = lc(f.color); if ((COLORS as readonly string[]).includes(color)) out.color = color;
  const format = lc(f.format); if (FORMAT_SET.has(format)) out.format = format;
  for (const k of NUMERIC_KEYS) {
    const n = typeof f[k] === 'number' ? f[k] as number : typeof f[k] === 'string' ? Number(f[k]) : NaN;
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  if (typeof f.heroLegal === 'string' && f.heroLegal.trim()) out.heroLegal = f.heroLegal.trim();
  // Curated function tags — only ids that exist right now (the list is live,
  // so the route passes it in); without a list the key is ignored entirely.
  if (opts.facetTagIds) {
    const facetTags = pickList(f.facetTags, opts.facetTagIds);
    if (facetTags) out.facetTags = facetTags;
  }
  return out;
}

// Filter fields only — view/sort prefs (sortBy, viewMode, gridCols, …) and the
// language pick are the user's and survive a translation.
const FILTER_DEFAULTS: Partial<OptUiState> = (() => {
  const { sortBy, sortOrder, viewMode, gridCols, groupByCard, selectedLanguages, ...filters } = DEFAULT_OPT_STATE;
  void sortBy; void sortOrder; void viewMode; void gridCols; void groupByCard; void selectedLanguages;
  return filters;
})();

/** Sanitised filters → the OptUiState patch the page dispatches. */
export function translationToOptState(filters: Translation): Partial<OptUiState> {
  const parsed = paramsToUiState(filtersToOptParams(filters));
  const state: Partial<OptUiState> = { ...FILTER_DEFAULTS, ...parsed };
  // No hero chip exists — carry the hero into the query as the hero: token the
  // shorthand parser already understands (first word, only if it resolves).
  if (typeof filters.heroLegal === 'string') {
    const first = filters.heroLegal.toLowerCase().split(/[\s,]+/)[0];
    if (first && resolveHeroShorthand(first)) {
      state.query = [`hero:${first}`, state.query ?? ''].filter(Boolean).join(' ');
    }
  }
  if (state.query === undefined) state.query = '';
  if (state.searchMode === undefined) state.searchMode = 'name';
  return state;
}

export function buildTranslateSystemPrompt(opts: { facetTags?: FacetTagVocab[] } = {}): string {
  const tags = opts.facetTags ?? [];
  return [
    'You translate a Flesh and Blood TCG card request written in plain English into ONE JSON object of search filters.',
    'Reply with the JSON object only — no prose, no code fence.',
    'Use only these keys (omit any you do not need):',
    '  name (card name to look up), text (rules-text phrase to search), classes[], talents[], keywords[], types[], rarities[], foilings[], editions[], sets[], format, pitch (1=red 2=yellow 3=blue; array for several), color (red|yellow|blue), heroLegal (hero name — cards that hero may play), heroAges[] (adult|young),',
    '  costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, arcaneMin, arcaneMax, healthMin, healthMax, priceMin, priceMax (numbers; price is USD)' + (tags.length ? ', facetTags[] (curated function tags, see list).' : '.'),
    `classes: ${ALL_CLASSES.join(', ')}`,
    `talents: ${ALL_TALENTS.join(', ')}`,
    `keywords: ${KEYWORDS.join(', ')}`,
    `types: ${TYPE_CHIPS.map((c) => c.apiType).join(', ')}`,
    `rarities: ${RARITY_OPTIONS.map((r) => `${r.value}=${r.label}`).join(', ')}`,
    `foilings: ${FOILING_OPTIONS.map((f) => `${f.value}=${f.label}`).join(', ')}`,
    `editions: ${EDITION_OPTIONS.map((e) => `${e.value}=${e.label}`).join(', ')}`,
    `sets (codes): ${CARD_FILTER_SETS.join(', ')}`,
    `format: ${FORMATS.join(', ')} (cc = Classic Constructed, future_cc = CC plus unreleased sets, ll = Living Legend)`,
    'Rules: a colour word means pitch/color, not a name. A class word (ninja, guardian…) is a class filter. A keyword phrase (go again, dominate…) is a keyword filter. Only use `name` when the user names a specific card. Do not invent values outside the lists.',
    '`text` is a SUBSTRING match on printed rules text, so write the words as they appear on cards — the card template, never the player\'s paraphrase, and never filler like "effect", "ability", "cards that", "with". Common asks → printed phrasing:',
    ...RULES_TEXT_PHRASINGS.map(([ask, text]) => `  ${ask} → text: "${text}"`),
    ...(tags.length ? [
      'facetTags are curated "what the card does" tags. Coverage is partial, so use one only for a function-level ask that has no printed phrasing (beats fatigue, combo enabler, disruption); for a mechanic with a printed phrasing use `text` instead, never both for the same idea. Available tags:',
      ...tags.map((t) => `  ${t.id} = ${t.label}${t.def ? ` — ${t.def}` : ''}`),
    ] : []),
    'Examples:',
    '  "blue ninja attacks with go again" → {"color":"blue","classes":["ninja"],"types":["attack"],"keywords":["go again"]}',
    '  "cheap majestics for dorinthea" → {"rarities":["m"],"heroLegal":"Dorinthea","priceMax":5}',
    '  "wizard cards that deal arcane damage" → {"classes":["wizard"],"text":"arcane damage"}',
    '  "runeblade attack with on hit effect" → {"classes":["runeblade"],"types":["attack"],"text":"when this hits"}',
    '  "rainbow foil command and conquer" → {"name":"command and conquer","foilings":["r"]}',
  ].join('\n');
}
