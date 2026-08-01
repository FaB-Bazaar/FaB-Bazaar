import { describe, it, expect } from 'vitest';
import { resolveHeroFilter } from './resolve-hero-filter';
import type { DeckDTO } from '@/lib/services/contracts/IDeckService';

// Minimal deck shells — resolveHeroFilter only reads hero[0].printingDetails
// and heroName.
const deckWith = (overrides: Partial<DeckDTO>): DeckDTO => ({ ...overrides } as DeckDTO);

describe('resolveHeroFilter', () => {
  it('returns null for a null deck', () => {
    expect(resolveHeroFilter(null)).toBeNull();
  });

  it('returns null when the deck has no hero and no heroName', () => {
    expect(resolveHeroFilter(deckWith({}))).toBeNull();
  });

  it('strategy 1a: uses the hero card\'s classes/talents fields, lowercased', () => {
    const deck = deckWith({
      hero: [{ printingDetails: { classes: ['Warrior'], talents: ['Light'], keywords: [] } }] as any,
    });
    expect(resolveHeroFilter(deck)).toEqual({
      heroClasses: ['warrior'], heroTalents: ['light'], heroEssences: [],
    });
  });

  it('strategy 1b: derives classes/talents from the types array when direct fields are empty', () => {
    const deck = deckWith({
      hero: [{ printingDetails: { classes: [], talents: [], types: ['Hero', 'Young', 'Wizard'], keywords: [] } }] as any,
    });
    expect(resolveHeroFilter(deck)).toEqual({
      heroClasses: ['wizard'], heroTalents: [], heroEssences: [],
    });
  });

  it('extracts essence elements from "essence of X" keywords', () => {
    const deck = deckWith({
      hero: [{ printingDetails: { classes: ['Runeblade'], talents: [], keywords: ['Essence of Lightning'] } }] as any,
    });
    expect(resolveHeroFilter(deck)?.heroEssences).toEqual(['lightning']);
  });

  it('essence matching is whole-word: "lightning" must not also grant "light"', () => {
    // Regression: the old substring match gave Lightning heroes the Light
    // talent in their legality pool.
    const deck = deckWith({
      hero: [{ printingDetails: { classes: ['Runeblade'], talents: [], keywords: ['Essence of Light'] } }] as any,
    });
    expect(resolveHeroFilter(deck)?.heroEssences).toEqual(['light']);
  });

  it('strategy 2: falls back to getHeroInfo lookup by heroName', () => {
    const deck = deckWith({ heroName: 'Arakni, Marionette' });
    expect(resolveHeroFilter(deck)).toEqual({
      heroClasses: ['assassin'], heroTalents: ['chaos'], heroEssences: [],
    });
  });

  it('strategy 3: treats an unknown heroName as a class name', () => {
    const deck = deckWith({ heroName: 'Mechanologist' });
    expect(resolveHeroFilter(deck)).toEqual({
      heroClasses: ['mechanologist'], heroTalents: [], heroEssences: [],
    });
  });

  it('strategy 3 guard: a talent-word heroName resolves to null, not a class', () => {
    const deck = deckWith({ heroName: 'Light' });
    expect(resolveHeroFilter(deck)).toBeNull();
  });
});
