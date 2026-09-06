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

// `generic` is a class value the DB stores (cards.classes) but not a hero class.
const SEARCHABLE_CLASSES: readonly string[] = [...HERO_CLASSES, 'generic'];

// Curated shorthand the unique-prefix rule can't reach on its own (initialisms,
// community names, prefixes that would otherwise be ambiguous).
export const CLASS_ALIASES: Record<string, string> = {
  mech: 'mechanologist',
  mecha: 'mechanologist',
  mechano: 'mechanologist',
  rb: 'runeblade',
  rune: 'runeblade',
  illu: 'illusionist',
  illus: 'illusionist',
  necro: 'necromancer',
  nec: 'necromancer',
  wiz: 'wizard',
  war: 'warrior',
  guard: 'guardian',
  sin: 'assassin',
  shifter: 'shapeshifter',
  adj: 'adjudicator',
  merch: 'merchant',
  gen: 'generic',
};

/**
 * Resolve a `c:` / `class:` token to the canonical class stored in the DB.
 * Exact name → curated alias → unambiguous prefix (2+ letters). Returns null
 * for ambiguous prefixes (`me` = mechanologist|merchant) and unknown input so
 * the caller can keep the raw token instead of guessing.
 */
export function resolveClassShorthand(input: string): string | null {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  if (SEARCHABLE_CLASSES.includes(q)) return q;
  if (CLASS_ALIASES[q]) return CLASS_ALIASES[q];
  if (q.length < 2) return null;
  const hits = SEARCHABLE_CLASSES.filter(c => c.startsWith(q));
  return hits.length === 1 ? hits[0] : null;
}
