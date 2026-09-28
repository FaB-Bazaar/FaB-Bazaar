// lib/fab-constants/formats.ts
// Game formats

export const FORMATS = [
  'blitz',
  'clash',
  'classic constructed',
  'draft',
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
  // Future CC was folded into CC (2026-09; CC decks take spoiler-season cards).
  // The old names stay as aliases so existing links and clients keep working.
  'fcc': 'Classic Constructed',
  'future cc': 'Classic Constructed',
  'future_cc': 'Classic Constructed',
  'future classic constructed': 'Classic Constructed',
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
