/**
 * Bidirectional mapping between the /opt search page's chip UI state and URL
 * query params, so a search is shareable/bookmarkable and restores on load.
 *
 * This maps the *UI state* (selected chips, ranges, sort, view) directly to the
 * URL — NOT PrintingsSearchFilters — so hydration is lossless (the filters
 * representation collapses some chips, e.g. class/talent into a union flag).
 *
 * Param names reuse the conventions in search-url-params.ts where they overlap
 * (q, classes, talents, sets, …). Only non-default values are written, keeping
 * shared URLs short and readable.
 *
 * Pure + framework-free → fully unit-testable; the page wires it to
 * useSearchParams (read on mount) + history.replaceState (write on change).
 */

export type HeroAge = 'adult' | 'young';
export type ViewMode = 'images' | 'checklist';

export interface OptUiState {
  query: string;
  // 'name' searches card names (default), 'text' searches rule text only.
  searchMode: 'name' | 'text';
  selectedType: string | null;
  selectedHeroAges: HeroAge[];
  selectedClasses: string[];
  selectedTalents: string[];
  selectedTalentless: boolean;
  /** Multi-select OR (e.g. red + blue). 0 is a real value (non-pitch cards). */
  selectedPitch: number[];
  selectedKeywords: string[];
  selectedRarities: string[];
  selectedFoilings: string[];
  selectedEditions: string[];
  selectedSets: string[];
  selectedPacks: number[];
  /** Curated facet tags (community + curator). Matched against cards.facet_tags. */
  selectedFacets: string[];
  /** false = ANY facet (overlap, default); true = ALL facets (contains). */
  facetsMatchAll: boolean;
  selectedFormat: string | null;
  costMin: string; costMax: string;
  powerMin: string; powerMax: string;
  defenseMin: string; defenseMax: string;
  arcaneMin: string; arcaneMax: string;
  priceMin: string; priceMax: string;
  selectedLanguages: string[];
  sortBy: string;
  sortOrder: string;
  viewMode: ViewMode;
  groupByCard: boolean;
}

// Default values — anything equal to these is omitted from the URL.
export const DEFAULT_OPT_STATE: OptUiState = {
  query: '',
  searchMode: 'name',
  selectedType: null,
  selectedHeroAges: [],
  selectedClasses: [],
  selectedTalents: [],
  selectedTalentless: false,
  selectedPitch: [],
  selectedKeywords: [],
  selectedRarities: [],
  selectedFoilings: [],
  selectedEditions: [],
  selectedSets: [],
  selectedPacks: [],
  selectedFacets: [],
  facetsMatchAll: false,
  selectedFormat: null,
  costMin: '', costMax: '',
  powerMin: '', powerMax: '',
  defenseMin: '', defenseMax: '',
  arcaneMin: '', arcaneMax: '',
  priceMin: '', priceMax: '',
  selectedLanguages: ['en'],
  sortBy: 'name',
  sortOrder: 'asc',
  viewMode: 'images',
  groupByCard: true,
};

const csv = (a: string[]) => a.join(',');
const splitCsv = (v: string | null): string[] =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];

/** Serialize UI state to URL params, omitting anything at its default. */
export function uiStateToParams(s: OptUiState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.query.trim()) p.set('q', s.query.trim());
  if (s.searchMode === 'text') p.set('mode', 'text');
  if (s.selectedType) p.set('type', s.selectedType);
  if (s.selectedHeroAges.length) p.set('heroAge', csv(s.selectedHeroAges));
  if (s.selectedClasses.length) p.set('classes', csv(s.selectedClasses));
  if (s.selectedTalents.length) p.set('talents', csv(s.selectedTalents));
  if (s.selectedTalentless) p.set('talentless', '1');
  if (s.selectedPitch.length) p.set('pitch', csv(s.selectedPitch.map(String)));
  if (s.selectedKeywords.length) p.set('keywords', csv(s.selectedKeywords));
  if (s.selectedRarities.length) p.set('rarities', csv(s.selectedRarities));
  if (s.selectedFoilings.length) p.set('foilings', csv(s.selectedFoilings));
  if (s.selectedEditions.length) p.set('editions', csv(s.selectedEditions));
  if (s.selectedSets.length) p.set('sets', csv(s.selectedSets));
  if (s.selectedPacks.length) p.set('pack', csv(s.selectedPacks.map(String)));
  if (s.selectedFacets.length) p.set('facets', csv(s.selectedFacets));
  // match-all only matters with facets selected; keep the URL clean otherwise.
  if (s.selectedFacets.length && s.facetsMatchAll) p.set('facetsAll', '1');
  if (s.selectedFormat) p.set('format', s.selectedFormat);
  if (s.costMin) p.set('costMin', s.costMin);
  if (s.costMax) p.set('costMax', s.costMax);
  if (s.powerMin) p.set('powerMin', s.powerMin);
  if (s.powerMax) p.set('powerMax', s.powerMax);
  if (s.defenseMin) p.set('defMin', s.defenseMin);
  if (s.defenseMax) p.set('defMax', s.defenseMax);
  if (s.arcaneMin) p.set('arcMin', s.arcaneMin);
  if (s.arcaneMax) p.set('arcMax', s.arcaneMax);
  if (s.priceMin) p.set('priceMin', s.priceMin);
  if (s.priceMax) p.set('priceMax', s.priceMax);
  // Languages: ['en'] is the default; [] means ALL languages (encode as 'all').
  const langs = s.selectedLanguages;
  const isDefaultLang = langs.length === 1 && langs[0] === 'en';
  if (!isDefaultLang) p.set('lang', langs.length === 0 ? 'all' : csv(langs));
  if (s.sortBy !== DEFAULT_OPT_STATE.sortBy) p.set('sortBy', s.sortBy);
  if (s.sortOrder !== DEFAULT_OPT_STATE.sortOrder) p.set('sortOrder', s.sortOrder);
  if (s.viewMode !== DEFAULT_OPT_STATE.viewMode) p.set('view', s.viewMode);
  if (s.groupByCard !== DEFAULT_OPT_STATE.groupByCard) p.set('group', s.groupByCard ? '1' : '0');
  return p;
}

/** Parse URL params into a partial UI state (only the keys actually present). */
export function paramsToUiState(p: URLSearchParams): Partial<OptUiState> {
  const out: Partial<OptUiState> = {};
  const q = p.get('q'); if (q) out.query = q;
  if (p.get('mode') === 'text') out.searchMode = 'text';
  const type = p.get('type'); if (type) out.selectedType = type;
  if (p.get('heroAge')) out.selectedHeroAges = splitCsv(p.get('heroAge')).filter((a): a is HeroAge => a === 'adult' || a === 'young');
  if (p.get('classes')) out.selectedClasses = splitCsv(p.get('classes'));
  if (p.get('talents')) out.selectedTalents = splitCsv(p.get('talents'));
  if (p.get('talentless') === '1') out.selectedTalentless = true;
  // csv OR legacy single value ("pitch=2" from pre-multi-select URLs).
  if (p.get('pitch')) {
    const pitches = splitCsv(p.get('pitch')).map(Number).filter((n) => !Number.isNaN(n));
    if (pitches.length) out.selectedPitch = pitches;
  }
  if (p.get('keywords')) out.selectedKeywords = splitCsv(p.get('keywords'));
  if (p.get('rarities')) out.selectedRarities = splitCsv(p.get('rarities'));
  if (p.get('foilings')) out.selectedFoilings = splitCsv(p.get('foilings'));
  if (p.get('editions')) out.selectedEditions = splitCsv(p.get('editions'));
  if (p.get('sets')) out.selectedSets = splitCsv(p.get('sets'));
  if (p.get('pack')) out.selectedPacks = splitCsv(p.get('pack')).map(Number).filter((n) => !Number.isNaN(n));
  if (p.get('facets')) out.selectedFacets = splitCsv(p.get('facets'));
  if (p.get('facetsAll') === '1') out.facetsMatchAll = true;
  const format = p.get('format'); if (format) out.selectedFormat = format;
  const setStr = (k: string, key: keyof OptUiState) => { const v = p.get(k); if (v) (out as Record<string, unknown>)[key] = v; };
  setStr('costMin', 'costMin'); setStr('costMax', 'costMax');
  setStr('powerMin', 'powerMin'); setStr('powerMax', 'powerMax');
  setStr('defMin', 'defenseMin'); setStr('defMax', 'defenseMax');
  setStr('arcMin', 'arcaneMin'); setStr('arcMax', 'arcaneMax');
  setStr('priceMin', 'priceMin'); setStr('priceMax', 'priceMax');
  const lang = p.get('lang');
  if (lang) out.selectedLanguages = lang === 'all' ? [] : splitCsv(lang);
  const sortBy = p.get('sortBy'); if (sortBy) out.sortBy = sortBy;
  const sortOrder = p.get('sortOrder'); if (sortOrder) out.sortOrder = sortOrder;
  const view = p.get('view'); if (view === 'images' || view === 'checklist') out.viewMode = view;
  const group = p.get('group'); if (group === '0' || group === '1') out.groupByCard = group === '1';
  return out;
}
