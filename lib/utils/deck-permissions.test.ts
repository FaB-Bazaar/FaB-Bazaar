import { describe, it, expect } from 'vitest';
import { canEditDeck } from './deck-permissions';

describe('canEditDeck', () => {
  it('returns true when the user is the deck owner', () => {
    expect(canEditDeck({ userId: 'user-1', coOwners: [] }, 'user-1')).toBe(true);
  });

  it('returns true when the user is in coOwners', () => {
    expect(canEditDeck({ userId: 'owner', coOwners: ['user-1', 'user-2'] }, 'user-2')).toBe(true);
  });

  it('returns false for an unrelated user', () => {
    expect(canEditDeck({ userId: 'owner', coOwners: ['user-1'] }, 'user-3')).toBe(false);
  });

  it('returns false when userId is null or undefined', () => {
    expect(canEditDeck({ userId: 'owner', coOwners: ['user-1'] }, null)).toBe(false);
    expect(canEditDeck({ userId: 'owner', coOwners: ['user-1'] }, undefined)).toBe(false);
  });

  it('treats missing coOwners as no co-owners', () => {
    expect(canEditDeck({ userId: 'owner' }, 'user-1')).toBe(false);
    expect(canEditDeck({ userId: 'owner', coOwners: null }, 'user-1')).toBe(false);
  });

  it('returns false when deck has no owner', () => {
    expect(canEditDeck({ userId: null, coOwners: [] }, 'user-1')).toBe(false);
  });
});
