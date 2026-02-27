/**
 * Utilities for encoding and decoding search filters to/from URL parameters
 * Enables shareable, bookmarkable search URLs (Scryfall-style)
 */

export interface SearchFilters {
  // Core search
  name?: string;
  text?: string;
  searchableText?: string;
  exact?: boolean;

  // Arrays
  sets?: string[];
  rarities?: string[];
  foilings?: string[];
  editions?: string[];
  colors?: string[];
  types?: string[];
  classes?: string[];
  talents?: string[];
  keywords?: string[];

  // Price
  priceMin?: number;
  priceMax?: number;
  priceField?: string;

  // Format & Hero
  format?: string;
  heroLegal?: string;

  // Boolean filters - Card Types
  isAction?: boolean;
  isAttack?: boolean;
  isDefenseReaction?: boolean;
  isInstant?: boolean;
  isEquipment?: boolean;
  isWeapon?: boolean;
  isHero?: boolean;

  // Boolean filters - Classes
  isGuardian?: boolean;
  isRuneblade?: boolean;
  isNecromancer?: boolean;
  isBrute?: boolean;
  isWarrior?: boolean;
  isNinja?: boolean;
  isWizard?: boolean;
  isMechanologist?: boolean;
  isRanger?: boolean;

  // Boolean filters - Talents
  hasElemental?: boolean;
  hasEarth?: boolean;
  hasIce?: boolean;
  hasLightning?: boolean;
  hasLight?: boolean;
  hasPirate?: boolean;
  hasShadow?: boolean;
  hasRoyal?: boolean;
  hasDraconic?: boolean;
  isGenericOnly?: boolean;
  hasClassAndTalent?: boolean;
  hasClassOnly?: boolean;
  hasTalentOnly?: boolean;

  // Boolean filters - Foiling
  isRainbowFoil?: boolean;
  isColdFoil?: boolean;
  isNormalFoil?: boolean;
  isExtendedArt?: boolean;

  // Boolean filters - Rarity
  isCommon?: boolean;
  isRare?: boolean;
  isMajestic?: boolean;
  isLegendary?: boolean;
  isFabled?: boolean;

  // Boolean filters - Price Convenience
  isBudget?: boolean;
  isUnder5?: boolean;
  isUnder10?: boolean;
  isUnder25?: boolean;
  isUnder50?: boolean;
  isUnder100?: boolean;
  isExpensive?: boolean;

  // Other
  includeBanned?: boolean;
}

export interface SearchOptions {
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: string;
  show?: string; // responseMode: 'summary' | 'gameplay' | 'identifiers' | 'all'
  viewMode?: 'checklist' | 'images' | 'text' | 'full';
}

/**
 * Convert filter state to URL search parameters
 */
export function filtersToURLParams(
  filters: SearchFilters,
  options?: SearchOptions
): URLSearchParams {
  const params = new URLSearchParams();

  // Simple string filters
  if (filters.name) params.set('q', filters.name);
  if (filters.text) params.set('text', filters.text);
  if (filters.searchableText) params.set('searchableText', filters.searchableText);
  if (filters.exact !== undefined) params.set('exact', String(filters.exact));

  // Array filters (comma-separated)
  if (filters.sets?.length) params.set('sets', filters.sets.join(','));
  if (filters.rarities?.length) params.set('rarities', filters.rarities.join(','));
  if (filters.foilings?.length) params.set('foilings', filters.foilings.join(','));
  if (filters.editions?.length) params.set('editions', filters.editions.join(','));
  if (filters.colors?.length) params.set('colors', filters.colors.join(','));
  if (filters.types?.length) params.set('types', filters.types.join(','));
  if (filters.classes?.length) params.set('classes', filters.classes.join(','));
  if (filters.talents?.length) params.set('talents', filters.talents.join(','));
  if (filters.keywords?.length) params.set('keywords', filters.keywords.join(','));

  // Price filters
  if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
  if (filters.priceField) params.set('priceField', filters.priceField);

  // Format & Hero
  if (filters.format) params.set('format', filters.format);
  if (filters.heroLegal) params.set('heroLegal', filters.heroLegal);

  // Boolean filters - only include if explicitly set (not undefined)
  const booleanFilters: Array<keyof SearchFilters> = [
    'isAction', 'isAttack', 'isDefenseReaction', 'isInstant', 'isEquipment', 'isWeapon', 'isHero',
    'isGuardian', 'isRuneblade', 'isNecromancer', 'isBrute', 'isWarrior', 'isNinja', 'isWizard', 'isMechanologist', 'isRanger',
    'hasElemental', 'hasEarth', 'hasIce', 'hasLightning', 'hasLight', 'hasPirate', 'hasShadow', 'hasRoyal', 'hasDraconic',
    'isGenericOnly', 'hasClassAndTalent', 'hasClassOnly', 'hasTalentOnly',
    'isRainbowFoil', 'isColdFoil', 'isNormalFoil', 'isExtendedArt',
    'isCommon', 'isRare', 'isMajestic', 'isLegendary', 'isFabled',
    'isBudget', 'isUnder5', 'isUnder10', 'isUnder25', 'isUnder50', 'isUnder100', 'isExpensive',
    'includeBanned'
  ];

  booleanFilters.forEach(key => {
    const value = filters[key];
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  // Options
  if (options) {
    if (options.page && options.page > 1) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);
    if (options.show) params.set('show', options.show);
    if (options.viewMode) params.set('view', options.viewMode);
  }

  return params;
}

/**
 * Parse URL search parameters into filter state
 */
export function urlParamsToFilters(searchParams: URLSearchParams | ReadonlyURLSearchParams): {
  filters: SearchFilters;
  options: SearchOptions;
} {
  const filters: SearchFilters = {};
  const options: SearchOptions = {};

  // Helper to get param value
  const get = (key: string) => searchParams.get(key);

  // Parse string filters
  const q = get('q');
  if (q) filters.name = q;

  const text = get('text');
  if (text) filters.text = text;

  const searchableText = get('searchableText');
  if (searchableText) filters.searchableText = searchableText;

  const exact = get('exact');
  if (exact !== null) filters.exact = exact === 'true';

  // Parse array filters (comma-separated)
  const parseArray = (key: string): string[] | undefined => {
    const value = get(key);
    return value ? value.split(',').filter(Boolean) : undefined;
  };

  filters.sets = parseArray('sets');
  filters.rarities = parseArray('rarities');
  filters.foilings = parseArray('foilings');
  filters.editions = parseArray('editions');
  filters.colors = parseArray('colors');
  filters.types = parseArray('types');
  filters.classes = parseArray('classes');
  filters.talents = parseArray('talents');
  filters.keywords = parseArray('keywords');

  // Parse price filters
  const priceMin = get('priceMin');
  if (priceMin) filters.priceMin = parseFloat(priceMin);

  const priceMax = get('priceMax');
  if (priceMax) filters.priceMax = parseFloat(priceMax);

  const priceField = get('priceField');
  if (priceField) filters.priceField = priceField;

  // Format & Hero
  const format = get('format');
  if (format) filters.format = format;

  const heroLegal = get('heroLegal');
  if (heroLegal) filters.heroLegal = heroLegal;

  // Parse boolean filters
  const parseBoolean = (key: string): boolean | undefined => {
    const value = get(key);
    return value !== null ? value === 'true' : undefined;
  };

  // Card Types
  filters.isAction = parseBoolean('isAction');
  filters.isAttack = parseBoolean('isAttack');
  filters.isDefenseReaction = parseBoolean('isDefenseReaction');
  filters.isInstant = parseBoolean('isInstant');
  filters.isEquipment = parseBoolean('isEquipment');
  filters.isWeapon = parseBoolean('isWeapon');
  filters.isHero = parseBoolean('isHero');

  // Classes
  filters.isGuardian = parseBoolean('isGuardian');
  filters.isRuneblade = parseBoolean('isRuneblade');
  filters.isNecromancer = parseBoolean('isNecromancer');
  filters.isBrute = parseBoolean('isBrute');
  filters.isWarrior = parseBoolean('isWarrior');
  filters.isNinja = parseBoolean('isNinja');
  filters.isWizard = parseBoolean('isWizard');
  filters.isMechanologist = parseBoolean('isMechanologist');
  filters.isRanger = parseBoolean('isRanger');

  // Talents
  filters.hasElemental = parseBoolean('hasElemental');
  filters.hasEarth = parseBoolean('hasEarth');
  filters.hasIce = parseBoolean('hasIce');
  filters.hasLightning = parseBoolean('hasLightning');
  filters.hasLight = parseBoolean('hasLight');
  filters.hasPirate = parseBoolean('hasPirate');
  filters.hasShadow = parseBoolean('hasShadow');
  filters.hasRoyal = parseBoolean('hasRoyal');
  filters.hasDraconic = parseBoolean('hasDraconic');
  filters.isGenericOnly = parseBoolean('isGenericOnly');
  filters.hasClassAndTalent = parseBoolean('hasClassAndTalent');
  filters.hasClassOnly = parseBoolean('hasClassOnly');
  filters.hasTalentOnly = parseBoolean('hasTalentOnly');

  // Foiling
  filters.isRainbowFoil = parseBoolean('isRainbowFoil');
  filters.isColdFoil = parseBoolean('isColdFoil');
  filters.isNormalFoil = parseBoolean('isNormalFoil');
  filters.isExtendedArt = parseBoolean('isExtendedArt');

  // Rarity
  filters.isCommon = parseBoolean('isCommon');
  filters.isRare = parseBoolean('isRare');
  filters.isMajestic = parseBoolean('isMajestic');
  filters.isLegendary = parseBoolean('isLegendary');
  filters.isFabled = parseBoolean('isFabled');

  // Price Convenience
  filters.isBudget = parseBoolean('isBudget');
  filters.isUnder5 = parseBoolean('isUnder5');
  filters.isUnder10 = parseBoolean('isUnder10');
  filters.isUnder25 = parseBoolean('isUnder25');
  filters.isUnder50 = parseBoolean('isUnder50');
  filters.isUnder100 = parseBoolean('isUnder100');
  filters.isExpensive = parseBoolean('isExpensive');

  // Other
  filters.includeBanned = parseBoolean('includeBanned');

  // Parse options
  const page = get('page');
  if (page) options.page = parseInt(page, 10);

  const limit = get('limit');
  if (limit) options.limit = parseInt(limit, 10);

  const sortBy = get('sortBy');
  if (sortBy) options.sortBy = sortBy;

  const sortOrder = get('sortOrder');
  if (sortOrder) options.sortOrder = sortOrder;

  const show = get('show');
  if (show) options.show = show;

  const view = get('view');
  if (view) options.viewMode = view as 'checklist' | 'images' | 'text' | 'full';

  return { filters, options };
}

/**
 * Helper to check if any filters are active
 */
export function hasActiveFilters(filters: SearchFilters): boolean {
  return Object.values(filters).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value !== undefined;
    return value !== undefined && value !== '' && value !== null;
  });
}

/**
 * Get human-readable label for a filter key
 */
export function getFilterLabel(key: keyof SearchFilters): string {
  const labels: Record<string, string> = {
    name: 'Name',
    text: 'Text',
    searchableText: 'Searchable Text',
    exact: 'Exact Match',
    sets: 'Sets',
    rarities: 'Rarities',
    foilings: 'Foiling',
    editions: 'Editions',
    colors: 'Colors',
    types: 'Types',
    classes: 'Classes',
    talents: 'Talents',
    keywords: 'Keywords',
    priceMin: 'Min Price',
    priceMax: 'Max Price',
    priceField: 'Price Field',
    format: 'Format',
    heroLegal: 'Hero Legal',
    isAction: 'Action',
    isAttack: 'Attack',
    isEquipment: 'Equipment',
    isWeapon: 'Weapon',
    isHero: 'Hero',
    isGuardian: 'Guardian',
    isWarrior: 'Warrior',
    isNinja: 'Ninja',
    isWizard: 'Wizard',
    isBrute: 'Brute',
    isRainbowFoil: 'Rainbow Foil',
    isColdFoil: 'Cold Foil',
    isNormalFoil: 'Normal Foil',
    isExtendedArt: 'Extended Art',
    isCommon: 'Common',
    isRare: 'Rare',
    isMajestic: 'Majestic',
    isLegendary: 'Legendary',
    isFabled: 'Fabled',
    isBudget: 'Budget',
    isUnder5: 'Under $5',
    isUnder10: 'Under $10',
    isUnder25: 'Under $25',
    isUnder50: 'Under $50',
    isUnder100: 'Under $100',
    isExpensive: 'Expensive',
    includeBanned: 'Include Banned',
  };

  return labels[key] || key;
}
