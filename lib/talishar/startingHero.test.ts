/**
 * Unit tests for resolveStartingHero — Talishar's `playerHero` / `opposingHero`
 * are a snapshot of the hero at GAME END, so a transformed hero (Teklovossen →
 * Mechropotent, Marionette → Redback, Levia → Blasmophet) reports the transformed
 * form. The `character` array keeps the hero card the player actually started
 * with as its first entry — that's the identity every matchup rollup wants.
 */

import { describe, it, expect } from 'vitest';
import { resolveStartingHero } from './startingHero';

describe('resolveStartingHero', () => {
  it('prefers the first character entry over the end-of-game playerHero', () => {
    expect(
      resolveStartingHero({
        playerHero: 'arakni_redback',
        character: [
          { cardId: 'arakni_marionette', cardName: 'Arakni, Marionette', numCopies: 1 },
          { cardId: 'hunters_klaive', cardName: "Hunter's Klaive", numCopies: 1 },
        ],
      })
    ).toBe('arakni_marionette');
  });

  it('falls back to playerHero when character is missing or empty', () => {
    expect(resolveStartingHero({ playerHero: 'dash_io' })).toBe('dash_io');
    expect(resolveStartingHero({ playerHero: 'dash_io', character: [] })).toBe('dash_io');
    expect(resolveStartingHero({ playerHero: 'dash_io', character: [{ cardId: '' }] })).toBe('dash_io');
  });

  it('returns undefined when neither is present', () => {
    expect(resolveStartingHero({})).toBeUndefined();
    expect(resolveStartingHero(undefined)).toBeUndefined();
  });
});
