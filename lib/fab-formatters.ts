// lib/fab-formatters.ts
import { 
  SET_MAP, 
  FOILING_MAP, 
  EDITION_MAP, 
  RARITY_MAP,
  SetCode,
  FoilingCode,
  EditionCode,
  RarityCode
} from './fab-constants';

// This helper function remains the same
function getNameFromMap<T extends string>(code: T | undefined | null, map: Record<T, string>): string {
if (!code) return '';
const lowerCode = code.toLowerCase() as T;
return map[lowerCode] || code;
}

// ... getSetName and getFoilingName remain the same ...
export function getSetName(code: string | undefined | null): string {
return getNameFromMap(code as SetCode, SET_MAP);
}

export function getFoilingName(code: string | undefined | null, isExtendedArt?: boolean): string {
const baseFoilingName = getNameFromMap(code as FoilingCode, FOILING_MAP);
if (isExtendedArt) {
  return baseFoilingName === 'Non-foil' ? 'Extended Art' : `EA ${baseFoilingName}`;
}
return baseFoilingName;
}


// --- STYLE MAPS ---
const VARIANT_STYLES_MAP = {
marvel: "bg-gradient-to-br from-purple-600 via-indigo-700 to-purple-800 text-white border border-purple-500 hover:opacity-95",
rainbow: "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white border-transparent hover:opacity-95",
cold: "bg-blue-600 text-white border border-blue-400 hover:bg-blue-700",
gold: "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-900 font-bold border border-yellow-600 hover:opacity-95",
default: "bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
};

const BADGE_STYLES_MAP = {
marvel: "bg-gradient-to-br from-purple-500 to-indigo-700 text-white border border-purple-400",
rainbow: "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white border-transparent",
cold: "bg-blue-600 text-white border border-blue-400",
gold: "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-900 font-bold border border-yellow-600",
// --- FIX 1: Add a new, distinct style for Extended Art ---
extendedArt: "bg-gray-700 text-white border border-gray-400",
default: "bg-gray-200 text-gray-800 border border-gray-300 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500"
};


// --- REFACTORED FUNCTIONS ---
export function getVariantStyles(rarity: string | null | undefined, foiling: string | null | undefined): string {
  if (rarity === 'v') return VARIANT_STYLES_MAP.marvel;
  switch (foiling) {
    case 'r': return VARIANT_STYLES_MAP.rainbow;
    case 'c': return VARIANT_STYLES_MAP.cold;
    case 'g': return VARIANT_STYLES_MAP.gold;
    default: return VARIANT_STYLES_MAP.default;
  }
};

// --- FIX 2: Update the badge styling function to be aware of Extended Art ---
export function getVariantBadgeStyles(
rarity: string | null | undefined,
foiling: string | null | undefined,
isExtendedArt?: boolean
): string {
  if (rarity === 'v') return BADGE_STYLES_MAP.marvel;

  // Prioritize foil colors
  switch (foiling) {
    case 'r': return BADGE_STYLES_MAP.rainbow;
    case 'c': return BADGE_STYLES_MAP.cold;
    case 'g': return BADGE_STYLES_MAP.gold;
  }
  
  // If it's not a special foil, check if it's Extended Art
  if (isExtendedArt) {
    return BADGE_STYLES_MAP.extendedArt;
  }

  // Otherwise, use the default style
  return BADGE_STYLES_MAP.default;
};

// ... getEditionName and getRarityName remain the same ...
export function getEditionName(code: string | undefined | null): string {
return getNameFromMap(code as EditionCode, EDITION_MAP);
}

export function getRarityName(code: string | undefined | null): string {
return getNameFromMap(code as RarityCode, RARITY_MAP);
}
