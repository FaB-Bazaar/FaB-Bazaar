// lib/fab-constants/rarities.ts
// Rarity mappings

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
