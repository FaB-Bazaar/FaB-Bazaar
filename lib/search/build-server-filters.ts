/**
 * Shared search helpers for the server-paginated card search used by /opt and
 * /search. Translates the pages' UI state (text query + filter chips) into the
 * structured PrintingsSearchFilters the search service understands.
 */

import { TYPE_CHIPS, GENERIC_CHIP } from '@/lib/search/card-filter-chips';
import { expandSetSelections } from '@/lib/fab-constants/sets';
import { FABShorthandParser } from '@/lib/search/fab-shorthand-parser';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';

// Module-level parser instance (stateless, safe to share).
const shorthandParser = new FABShorthandParser();

// Server page size for infinite scroll.
export const PAGE_SIZE = 60;

// Default to English printings only — non-English printings carry no TCGplayer
// ids or prices in our data. The Language control can expand to specific
// languages or ALL.
export const DEFAULT_LANGUAGES = ['en'];

// Physical printing languages present in the catalog.
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'ja', label: 'Japanese' },
];

// Detects whether the query string uses shorthand syntax (t:, p:<5, cost:, …).
export const SHORTHAND_RE = /\b(cost|power|pow|defense|def|type|t|talent|tal|rarity|r|foil|f|set|edition|color|class|c|hero|h|keyword|k|text|format|p|arcane|health|life):/;

export interface SearchUiState {
  query: string;
  // 'name' (default): a bare query matches card names. 'text': a bare query
  // matches rule text only. Shorthand (t:, text:"…") parses the same either way
  // — the mode only changes the plain-string fallback below.
  searchMode?: 'name' | 'text';
  selectedType: string | null;
  selectedClasses: string[];
  selectedTalents: string[];
  selectedTalentless?: boolean;
  /** Multi-select OR; empty = no pitch filter. */
  selectedPitch: number[];
  selectedKeywords: string[];
  selectedRarities: string[];
  selectedFoilings: string[];
  selectedEditions: string[];
  selectedSets: string[];
  // Curated facet tags. facetsMatchAll=false → ANY (overlap); true → ALL (contains).
  selectedFacets?: string[];
  facetsMatchAll?: boolean;
  // TCGplayer group ids (sub-set packs, e.g. GEM Pack N). Only meaningful when a
  // multi-group set like GEM is selected.
  selectedTcgGroups?: number[];
  selectedFormat?: PrintingsSearchFilters['format'] | null;
  selectedHeroAges?: Array<'adult' | 'young'>;
  costMin: string; costMax: string;
  powerMin: string; powerMax: string;
  defenseMin: string; defenseMax: string;
  arcaneMin?: string; arcaneMax?: string;
  healthMin?: string; healthMax?: string;
  priceMin?: string; priceMax: string;
}

/**
 * Build structured server filters from UI state. The text query is parsed with
 * the shorthand parser when it looks like shorthand, else treated as a name.
 * Chip selections layer on top (and win on conflict).
 */
export function buildServerFilters(s: SearchUiState): PrintingsSearchFilters {
  let f: PrintingsSearchFilters = {};

  const q = s.query.trim();
  if (q.length >= 2) {
    if (SHORTHAND_RE.test(q)) {
      const { filters } = shorthandParser.parseQuery(q);
      f = { ...filters };
      // The parser maps leftover bare words to a name search. In text mode
      // those words are the rule-text query ("hits class:guardian") — unless
      // an explicit text: token already claimed the text slot.
      if (s.searchMode === 'text' && f.name !== undefined && f.text === undefined) {
        f.text = f.name;
        delete f.name;
      }
    } else if (s.searchMode === 'text') {
      f.text = q;
    } else {
      f.name = q;
    }
  }

  // Multi-select OR — the service ORs arrays via inArray(cards.pitch, …).
  if (s.selectedPitch.length) f.pitch = s.selectedPitch;
  if (s.selectedType) {
    if (s.selectedType === 'generic') {
      f.isGenericOnly = true;
    } else {
      const chip = [...TYPE_CHIPS, GENERIC_CHIP].find(c => c.value === s.selectedType);
      if (chip) f.types = [chip.apiType];
    }
  }
  // Classes are OR'd server-side (array overlap). 'generic' is just another
  // class value here — selecting a class + Generic returns the union, not the
  // (empty) intersection the old isGenericOnly Type chip produced.
  if (s.selectedClasses.length) f.classes = s.selectedClasses;
  if (s.selectedTalents.length) f.talents = s.selectedTalents;
  // Class + Talent chips form one OR'd affiliation set (a hero's pool is
  // class ∪ talent ∪ generic), so e.g. Generic + Lightning returns all generic
  // cards AND all lightning cards rather than their intersection.
  if (s.selectedClasses.length || s.selectedTalents.length) f.classTalentUnion = true;
  // Talentless: cards any hero of the selected class(es) can play (no talent).
  if (s.selectedTalentless) f.talentless = true;
  if (s.selectedKeywords.length) f.keywords = s.selectedKeywords;
  if (s.selectedRarities.length) f.rarities = s.selectedRarities;
  if (s.selectedFoilings.length) f.foilings = s.selectedFoilings;
  if (s.selectedEditions.length) f.editions = s.selectedEditions;
  // selectedSets holds plain codes plus grp: deck-product tokens — flatten to
  // the exact code list the service's inArray filter expects.
  if (s.selectedSets.length) f.sets = expandSetSelections(s.selectedSets);
  if (s.selectedFacets?.length) {
    f.facetTags = s.selectedFacets;
    if (s.facetsMatchAll) f.facetTagsMode = 'all';
  }
  if (s.selectedTcgGroups?.length) f.tcgGroupIds = s.selectedTcgGroups;
  if (s.selectedFormat) f.format = s.selectedFormat;
  if (s.selectedHeroAges?.length) f.heroAges = s.selectedHeroAges;
  if (s.costMin)    f.costMin    = parseFloat(s.costMin);
  if (s.costMax)    f.costMax    = parseFloat(s.costMax);
  if (s.powerMin)   f.powerMin   = parseFloat(s.powerMin);
  if (s.powerMax)   f.powerMax   = parseFloat(s.powerMax);
  if (s.defenseMin) f.defenseMin = parseFloat(s.defenseMin);
  if (s.defenseMax) f.defenseMax = parseFloat(s.defenseMax);
  if (s.arcaneMin)  f.arcaneMin  = parseFloat(s.arcaneMin);
  if (s.arcaneMax)  f.arcaneMax  = parseFloat(s.arcaneMax);
  if (s.healthMin)  f.healthMin  = parseFloat(s.healthMin);
  if (s.healthMax)  f.healthMax  = parseFloat(s.healthMax);
  // Health targets allies/creatures by default — hero life totals (20/40)
  // would swamp every range. Heroes stay excluded unless the user opts in via
  // the hero-age chips or an explicit hero token in the query (t:hero, heroes).
  const hasHealthFilter = f.health !== undefined || f.healthMin !== undefined || f.healthMax !== undefined;
  const heroOptIn = (s.selectedHeroAges?.length ?? 0) > 0 || (f.heroAges?.length ?? 0) > 0
    || f.isHero === true || (f.types ?? []).some((t) => t.includes('hero'));
  if (hasHealthFilter && !heroOptIn) f.isHero = false;
  if (s.priceMin)   { f.priceMin = parseFloat(s.priceMin); f.priceField = 'tcg_low'; }
  if (s.priceMax)   { f.priceMax = parseFloat(s.priceMax); f.priceField = 'tcg_low'; }

  return f;
}
