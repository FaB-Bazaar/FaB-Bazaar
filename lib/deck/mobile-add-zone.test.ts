import { describe, it, expect } from 'vitest';
import { resolveMobileAddCategory, pickRemovalSlot } from './mobile-add-zone';

const action = { types: ['Action', 'Attack'] };
const equipment = { types: ['Equipment', 'Head'] };
const hero = { types: ['Hero', 'Young'] };

describe('resolveMobileAddCategory', () => {
  it('adds to the bench when the bench is the active zone', () => {
    expect(resolveMobileAddCategory('benched', action)).toBe('benched');
  });

  it('adds equipment to the inventory when the inventory is the active zone', () => {
    expect(resolveMobileAddCategory('inventory', equipment)).toBe('inventory');
  });

  it('infers equipment from the card type when no zone is active', () => {
    expect(resolveMobileAddCategory(null, equipment)).toBe('equipment');
  });

  it('infers maindeck from the card type when no zone is active', () => {
    expect(resolveMobileAddCategory(null, action)).toBe('maindeck');
  });

  it('still infers equipment when the active zone is the maindeck (the default)', () => {
    expect(resolveMobileAddCategory('maindeck', equipment)).toBe('equipment');
  });

  it('a hero card is always the hero, whatever zone is active', () => {
    expect(resolveMobileAddCategory('benched', hero)).toBe('hero');
  });
});

describe('pickRemovalSlot', () => {
  const slots = [
    { printingId: 'p1', quantity: 2, category: 'maindeck' as const },
    { printingId: 'p2', quantity: 1, category: 'benched' as const },
  ];

  it('removes from the active zone when the card sits there', () => {
    expect(pickRemovalSlot(slots, 'benched')).toEqual(slots[1]);
  });

  it('falls back to the first slot when the active zone has no copy', () => {
    expect(pickRemovalSlot(slots, 'inventory')).toEqual(slots[0]);
  });

  it('falls back to the first slot when no zone is active', () => {
    expect(pickRemovalSlot(slots, null)).toEqual(slots[0]);
  });

  it('returns undefined for an empty slot list', () => {
    expect(pickRemovalSlot([], 'benched')).toBeUndefined();
  });
});
