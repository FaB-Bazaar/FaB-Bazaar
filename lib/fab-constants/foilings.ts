// lib/fab-constants/foilings.ts
// Foiling and art variation mappings

export const FOILING_MAP = {
  // Rainbow Foil
  'r': 'Rainbow Foil',
  'rf': 'Rainbow Foil',
  'rainbow': 'Rainbow Foil',
  'rainbow foil': 'Rainbow Foil',

  // Cold Foil
  'c': 'Cold Foil',
  'cf': 'Cold Foil',
  'cold': 'Cold Foil',
  'cold foil': 'Cold Foil',

  // Standard/Non-foil
  's': 'Non-foil',
  'nf': 'Non-foil',
  'n': 'Non-foil',
  'standard': 'Non-foil',
  'non-foil': 'Non-foil',
  'nonfoil': 'Non-foil',

  // Gold Foil
  'g': 'Gold Foil',
  'gf': 'Gold Foil',
  'gold': 'Gold Foil',
  'gold foil': 'Gold Foil'
} as const;

/**
 * Foiling display styles for badges
 * Static gradients and colors for foiling types
 */
export const FOILING_STYLES = {
  r: {
    name: 'Rainbow Foil',
    shortName: 'RF',
    className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white'
  },
  c: {
    name: 'Cold Foil',
    shortName: 'CF',
    className: 'bg-blue-600 text-white'
  },
  g: {
    name: 'Gold Foil',
    shortName: 'GF',
    className: 'bg-yellow-500 text-black'
  },
  s: {
    name: 'Non-foil',
    shortName: 'NF',
    className: 'bg-gray-500 text-white'
  },
  n: {
    name: 'Non-foil',
    shortName: 'NF',
    className: 'bg-gray-500 text-white'
  }
} as const;

export const ART_VARIATIONS_MAP = {
  // Alternate Border
  'ab': 'Alternate Border',
  'alternate border': 'Alternate Border',

  // Alternate Art
  'aa': 'Alternate Art',
  'alternate art': 'Alternate Art',

  // Alternate Text
  'at': 'Alternate Text',
  'alternate text': 'Alternate Text',

  // Extended Art
  'ea': 'Extended Art',
  'extended art': 'Extended Art',

  // Full Art
  'fa': 'Full Art',
  'full art': 'Full Art',

  // Half Size
  'hs': 'Half Size',
  'half size': 'Half Size'
} as const;

export type FoilingCode = keyof typeof FOILING_MAP;
export type ArtVariationCode = keyof typeof ART_VARIATIONS_MAP;
