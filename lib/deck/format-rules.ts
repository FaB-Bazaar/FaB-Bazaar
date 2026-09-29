// lib/deck/format-rules.ts
// Official card-pool rules for the constructed formats — the ONE table the
// add-card copy gate (validateCopyLimit) and the MCP deckbuilding guide read.
// Source: fabtcg.com/gameplay-formats/* + TRP section 7 (verified 2026-09-29).
// A "unique card" is name + pitch color; the copy limit covers weapons and
// equipment too. Blitz went singleton (1 copy) and dropped its banned list on
// 2026-01-01.

export type ConstructedFormat =
  | 'Classic Constructed'
  | 'Living Legend'
  | 'Blitz'
  | 'Silver Age'
  | 'Commoner';

export interface FormatRules {
  heroAge: 'adult' | 'young';
  /** Hero excluded: weapons + equipment + deck cards. */
  maxCardPool: number;
  deckSize: { exact: number } | { min: number };
  maxCopies: number;
  /** Extra construction rules, stated as the official pages state them. */
  notes: string[];
}

export const CONSTRUCTED_FORMAT_RULES: Record<ConstructedFormat, FormatRules> = {
  'Classic Constructed': {
    heroAge: 'adult',
    maxCardPool: 80,
    deckSize: { min: 60 },
    maxCopies: 3,
    notes: ['Young heroes, pit-fighter heroes and Living Legend heroes are not legal.'],
  },
  'Living Legend': {
    heroAge: 'adult',
    maxCardPool: 80,
    deckSize: { min: 60 },
    maxCopies: 3,
    notes: ['Like Classic Constructed, but Living Legend heroes and their signature weapons are legal.'],
  },
  Blitz: {
    heroAge: 'young',
    maxCardPool: 52,
    deckSize: { exact: 40 },
    maxCopies: 1,
    notes: ['Singleton since 2026-01-01; the Blitz banned/restricted list was abolished the same day.'],
  },
  'Silver Age': {
    heroAge: 'young',
    maxCardPool: 55,
    deckSize: { exact: 40 },
    maxCopies: 2,
    notes: ['Every card, hero included, must be common, rare or basic rarity.'],
  },
  Commoner: {
    heroAge: 'young',
    maxCardPool: 52,
    deckSize: { exact: 40 },
    maxCopies: 2,
    notes: [
      'Hero, weapons and equipment may be common or rare; cards in the deck must be common.',
    ],
  },
};

const RULES_BY_LOWER = new Map<string, FormatRules>(
  Object.entries(CONSTRUCTED_FORMAT_RULES).map(([name, rules]) => [name.toLowerCase(), rules]),
);
// Future Classic Constructed was folded into CC (migration 0121); old decks keep the name.
RULES_BY_LOWER.set('future classic constructed', CONSTRUCTED_FORMAT_RULES['Classic Constructed']);

export function getFormatRules(format: string): FormatRules | null {
  return RULES_BY_LOWER.get(format.trim().toLowerCase()) ?? null;
}

/** Per-card copy limit, or null for free-form formats (Casual, Limited, UPF). */
export function maxCopiesFor(format: string): number | null {
  return getFormatRules(format)?.maxCopies ?? null;
}
