/**
 * normalizeDeckCategory — single source of truth for turning caller-supplied
 * zone names into the DB `deck_category` enum.
 *
 * Why: the DB enum is hero/equipment/maindeck/inventory/benched/tokens
 * ('sideboard' was dropped in migration 0011), but the MCP tools advertised
 * "sideboard" and passed it straight to the add route → Postgres enum error.
 * In Flesh and Blood the sideboard IS the inventory; "benched" is a separate
 * maybe-pile that never reaches Talishar.
 */
import { describe, it, expect } from 'vitest';
import { normalizeDeckCategory, DECK_CATEGORIES } from './deck-category';

describe('normalizeDeckCategory', () => {
  it('passes canonical enum values through unchanged', () => {
    for (const c of DECK_CATEGORIES) {
      expect(normalizeDeckCategory(c)).toBe(c);
    }
  });

  it('maps "sideboard" to "inventory" (FaB sideboard = inventory)', () => {
    expect(normalizeDeckCategory('sideboard')).toBe('inventory');
  });

  it('is case/whitespace-insensitive', () => {
    expect(normalizeDeckCategory('  Sideboard ')).toBe('inventory');
    expect(normalizeDeckCategory('MAINDECK')).toBe('maindeck');
  });

  it('maps common aliases', () => {
    expect(normalizeDeckCategory('sb')).toBe('inventory');
    expect(normalizeDeckCategory('inv')).toBe('inventory');
    expect(normalizeDeckCategory('bench')).toBe('benched');
    expect(normalizeDeckCategory('maybeboard')).toBe('benched');
    expect(normalizeDeckCategory('main')).toBe('maindeck');
    expect(normalizeDeckCategory('library')).toBe('maindeck');
    expect(normalizeDeckCategory('gear')).toBe('equipment');
    expect(normalizeDeckCategory('token')).toBe('tokens');
  });

  it('returns null for unknown or non-string input', () => {
    expect(normalizeDeckCategory('graveyard')).toBeNull();
    expect(normalizeDeckCategory('')).toBeNull();
    expect(normalizeDeckCategory(undefined)).toBeNull();
    expect(normalizeDeckCategory(null)).toBeNull();
    expect(normalizeDeckCategory(42)).toBeNull();
  });
});
