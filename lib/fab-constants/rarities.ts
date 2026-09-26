// lib/fab-constants/rarities.ts
// Rarity mappings

/**
 * Sort rank for rarity codes (ascending = rarest first; Promo leads).
 * Shared by the search service's SQL sort and the client-side browse sort.
 */
export const RARITY_SORT_ORDER = ['p', 'f', 'v', 'l', 'm', 's', 'r', 'c', 'b', 't'] as const;

export const RARITY_MAP = {
  // Common
  'c': 'Common',
  'common': 'Common',

  // Rare
  'r': 'Rare',
  'rare': 'Rare',

  // Super Rare
  's': 'Super Rare',
  'super rare': 'Super Rare',
  'super': 'Super Rare',

  // Majestic
  'm': 'Majestic',
  'majestic': 'Majestic',
  'maj': 'Majestic',

  // Legendary
  'l': 'Legendary',
  'legendary': 'Legendary',
  'leg': 'Legendary',

  // Fabled
  'f': 'Fabled',
  'fabled': 'Fabled',
  'fab': 'Fabled',

  // Token
  't': 'Token',
  'token': 'Token',

  // Basic
  'b': 'Basic',
  'basic': 'Basic',

  // Marvel
  'v': 'Marvel',
  'marvel': 'Marvel',

  // Promo
  'p': 'Promo',
  'promo': 'Promo'
} as const;

export type RarityCode = keyof typeof RARITY_MAP;
