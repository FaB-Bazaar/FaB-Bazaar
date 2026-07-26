// components/deck/editor/mobile-list-row.test.ts
//
// Pure helpers behind the concise mobile deck-list row (qty · pitch · name · type icon · owned).
// Type arrays below are real values from the `cards.types` column.

import { describe, it, expect } from 'vitest';
import { deriveCardType, mobileTypeKey, mobileTypeLabel, ownershipStatus } from './mobile-list-row';

describe('deriveCardType', () => {
  it('reads Attack from an "action - attack" card', () => {
    expect(deriveCardType(['warrior', 'action', 'attack'])).toBe('Attack');
  });

  it('prefers the reaction types over the bare Attack/Action words', () => {
    expect(deriveCardType(['ninja', 'attack reaction'])).toBe('Atk Reaction');
    expect(deriveCardType(['guardian', 'action', 'defense reaction', 'trap'])).toBe('Def Reaction');
  });

  it('reads Action from a "mechanologist action - item" card', () => {
    expect(deriveCardType(['mechanologist', 'action', 'item'])).toBe('Action');
  });

  it('reads Instant', () => {
    expect(deriveCardType(['assassin', 'instant', 'item'])).toBe('Instant');
  });

  it('reads Equipment, Weapon and Hero', () => {
    expect(deriveCardType(['guardian', 'equipment', 'chest'])).toBe('Equipment');
    expect(deriveCardType(['bard', 'weapon', 'lute', '2h'])).toBe('Weapon');
    expect(deriveCardType(['mechanologist', 'hero', 'young'])).toBe('Hero');
  });

  it('reads Resource for gems, which the old ladder rendered as an em dash', () => {
    expect(deriveCardType(['assassin', 'ranger', 'resource', 'gem'])).toBe('Resource');
  });

  it('reads Block for the bard block cards', () => {
    expect(deriveCardType(['bard', 'block'])).toBe('Block');
  });

  it('falls back to Item when item is the only type word left', () => {
    expect(deriveCardType(['generic', 'item'])).toBe('Item');
  });

  it('returns an empty string for an unrecognised type list', () => {
    expect(deriveCardType(['generic', 'placeholder card'])).toBe('');
    expect(deriveCardType([])).toBe('');
  });
});

describe('mobileTypeKey', () => {
  it('maps each derived type to its icon key', () => {
    expect(mobileTypeKey('Attack')).toBe('attack');
    expect(mobileTypeKey('Atk Reaction')).toBe('attack-reaction');
    expect(mobileTypeKey('Def Reaction')).toBe('defense-reaction');
    expect(mobileTypeKey('Block')).toBe('defense-reaction');
    expect(mobileTypeKey('Action')).toBe('action');
    expect(mobileTypeKey('Instant')).toBe('instant');
    expect(mobileTypeKey('Item')).toBe('item');
    expect(mobileTypeKey('Equipment')).toBe('equipment');
    expect(mobileTypeKey('Weapon')).toBe('weapon');
    expect(mobileTypeKey('Resource')).toBe('resource');
    expect(mobileTypeKey('Hero')).toBe('hero');
    expect(mobileTypeKey('Token')).toBe('token');
  });

  it('returns null for an unknown or empty type so the row can render nothing', () => {
    expect(mobileTypeKey('')).toBeNull();
    expect(mobileTypeKey('Landmark')).toBeNull();
  });
});

describe('mobileTypeLabel', () => {
  // The icon is the only type cue in the row, so it needs a text alternative (WCAG 1.1.1).
  it('gives every icon key a spoken label', () => {
    expect(mobileTypeLabel('attack')).toBe('Attack');
    expect(mobileTypeLabel('attack-reaction')).toBe('Attack Reaction');
    expect(mobileTypeLabel('defense-reaction')).toBe('Defense Reaction');
    expect(mobileTypeLabel('action')).toBe('Action');
    expect(mobileTypeLabel('instant')).toBe('Instant');
    expect(mobileTypeLabel('item')).toBe('Item');
    expect(mobileTypeLabel('equipment')).toBe('Equipment');
    expect(mobileTypeLabel('weapon')).toBe('Weapon');
    expect(mobileTypeLabel('resource')).toBe('Resource');
    expect(mobileTypeLabel('hero')).toBe('Hero');
    expect(mobileTypeLabel('token')).toBe('Token');
  });
});

describe('ownershipStatus', () => {
  it('is untracked when the deck carries no ownership entry for the card', () => {
    expect(ownershipStatus({ hasOwnership: false, totalOwned: 0, totalQty: 3 })).toBe('untracked');
  });

  it('is full when owned copies cover the deck quantity', () => {
    expect(ownershipStatus({ hasOwnership: true, totalOwned: 3, totalQty: 3 })).toBe('full');
    expect(ownershipStatus({ hasOwnership: true, totalOwned: 5, totalQty: 3 })).toBe('full');
  });

  it('is partial when some copies are missing, including zero owned', () => {
    expect(ownershipStatus({ hasOwnership: true, totalOwned: 1, totalQty: 3 })).toBe('partial');
    expect(ownershipStatus({ hasOwnership: true, totalOwned: 0, totalQty: 3 })).toBe('partial');
  });
});
