/**
 * Deck zone normalization — the one place caller-supplied zone names become
 * the DB `deck_category` enum.
 *
 * Zones (mirrors the Postgres enum; 'sideboard' was dropped in migration 0011):
 *   hero, equipment, maindeck, inventory, benched, tokens
 *
 * In Flesh and Blood the sideboard IS the inventory (what Talishar imports as
 * the sideboard). "benched" is a separate maybe-pile — cards a player is
 * considering but that aren't part of the playable deck; never exported to
 * Talishar and never part of a matchup pool.
 */
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

export const DECK_CATEGORIES: readonly DeckCategory[] = [
  'hero',
  'equipment',
  'maindeck',
  'inventory',
  'benched',
  'tokens',
] as const;

const ALIASES: Record<string, DeckCategory> = {
  // sideboard = inventory
  sideboard: 'inventory',
  side: 'inventory',
  sb: 'inventory',
  inv: 'inventory',
  // maybe-pile
  bench: 'benched',
  maybe: 'benched',
  maybeboard: 'benched',
  // library
  main: 'maindeck',
  library: 'maindeck',
  deck: 'maindeck',
  // gear
  gear: 'equipment',
  weapon: 'equipment',
  weapons: 'equipment',
  // tokens
  token: 'tokens',
};

/**
 * Normalize a caller-supplied zone name to a DeckCategory, or null if it isn't
 * one we recognise. Case- and whitespace-insensitive.
 */
export function normalizeDeckCategory(raw: unknown): DeckCategory | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if ((DECK_CATEGORIES as readonly string[]).includes(key)) return key as DeckCategory;
  return ALIASES[key] ?? null;
}
