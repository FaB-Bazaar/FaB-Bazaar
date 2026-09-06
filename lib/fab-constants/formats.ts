// lib/fab-constants/formats.ts
// Game formats

export const FORMATS = [
  'blitz',
  'clash',
  'classic constructed',
  'draft',
  'future classic constructed',
  'living legend',
  'open',
  'sealed',
  'silver age',
  'ultimate pit fight'
] as const;

// Abbreviated format codes
export const FORMAT_CODES = {
  'blitz': 'Blitz',
  'clash': 'Clash',
  'cc': 'Classic Constructed',
  'classic constructed': 'Classic Constructed',
  'draft': 'Draft',
  'fcc': 'Future Classic Constructed',
  'future cc': 'Future Classic Constructed',
  'future_cc': 'Future Classic Constructed',
  'future classic constructed': 'Future Classic Constructed', // CC pool + every card from a set whose release date is still ahead
  'll': 'Living Legend',
  'living legend': 'Living Legend',
  'open': 'Open',
  'sealed': 'Sealed',
  'silver age': 'Silver Age',
  'silver_age': 'Silver Age',
  'sage': 'Silver Age', // community shorthand for Silver Age
  'upf': 'Ultimate Pit Fight',
  'ultimate pit fight': 'Ultimate Pit Fight'
} as const;

export type Format = typeof FORMATS[number];
export type FormatCode = keyof typeof FORMAT_CODES;
