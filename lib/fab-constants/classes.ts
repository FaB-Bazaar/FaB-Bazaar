// lib/fab-constants/classes.ts
// Hero classes

export const HERO_CLASSES = [
  'adjudicator',
  'assassin',
  'bard',
  'brute',
  'guardian',
  'illusionist',
  'mechanologist',
  'merchant',
  'necromancer',
  'ninja',
  'pirate',
  'ranger',
  'runeblade',
  'shapeshifter',
  'thief',
  'warrior',
  'wizard'
] as const;

export type HeroClass = typeof HERO_CLASSES[number];
