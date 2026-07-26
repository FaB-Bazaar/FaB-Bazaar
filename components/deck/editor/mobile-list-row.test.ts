// components/deck/editor/mobile-list-row.test.ts
//
// Pure helpers behind the concise mobile deck-list row (qty · pitch · name · owned).
// Type arrays below are real values from the `cards.types` column.
//
// deriveCardType feeds the DESKTOP Type column — the mobile row shows no type cue
// (the icon set was pulled 2026-07 pending a better one).

import { describe, it, expect } from 'vitest';
import { deriveCardType, ownershipStatus } from './mobile-list-row';

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
