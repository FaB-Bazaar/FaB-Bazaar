// lib/fab-constants/editions.ts
// Edition mappings

export const EDITION_MAP = {
  // Alpha
  'a': 'Alpha',
  'alpha': 'Alpha',

  // First Edition
  'f': 'First Edition',
  'first': 'First Edition',
  '1st': 'First Edition',
  'first edition': 'First Edition',

  // Unlimited
  'u': 'Unlimited',
  'unl': 'Unlimited',
  'unlimited': 'Unlimited',
  'unlimited edition': 'Unlimited',

  // Normal/No Edition
  'n': 'Normal',
  'normal': 'Normal',
  'promo': 'Normal'
} as const;

export type EditionCode = keyof typeof EDITION_MAP;
