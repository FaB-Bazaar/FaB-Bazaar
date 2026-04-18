// lib/fab-constants/index.ts
// Central export point for all FaB constants

// Sets
export {
  SET_MAP,
  SET_METADATA,
  getSetMetadata,
  hasFirstEdition,
  getAllSetCodes,
  getSetsInDisplayOrder,
  getSetCodesInDisplayOrder,
  getOrderedSets,
  sortPrintings,
  type SetCode,
  type SetMetadata,
} from './sets';

// Foilings and Art Variations
export {
  FOILING_MAP,
  FOILING_STYLES,
  ART_VARIATIONS_MAP,
  type FoilingCode,
  type ArtVariationCode,
} from './foilings';

// Editions
export {
  EDITION_MAP,
  type EditionCode,
} from './editions';

// Rarities
export {
  RARITY_MAP,
  type RarityCode,
} from './rarities';

// Keywords
export {
  KEYWORDS,
  type Keyword,
} from './keywords';

// Cards
export {
  CARD_NAME_ABBREVIATIONS,
  CARD_TYPES,
  COLORS,
  COLOR_STYLES,
  EQUIPMENT_SUBTYPES,
  type CardNameAbbreviation,
  type CardType,
  type Color,
} from './cards';

// Classes
export {
  HERO_CLASSES,
  type HeroClass,
} from './classes';

// Formats
export {
  FORMATS,
  FORMAT_CODES,
  type Format,
  type FormatCode,
} from './formats';

// Ranges
export {
  PRICE_RANGES,
  POWER_RANGES,
  COST_RANGES,
} from './ranges';

// Heroes
export {
  HERO_NICKNAMES,
  HERO_INFO,
  YOUNG_HERO_INFO,
  TALISHAR_HERO_IDS,
  getHeroInfo,
  getHeroesGroupedByClass,
  getYoungHeroesGroupedByClass,
  getAllClasses,
  normalizeHeroName,
  normalizeClassName,
  toHeroDisplayName,
  getHeroesByFormatDetailed,
  type HeroInfo,
  type HeroEntry,
  type ResourceLink,
  type HeroName,
  type YoungHeroName,
} from './heroes';
