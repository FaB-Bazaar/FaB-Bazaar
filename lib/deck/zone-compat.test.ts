/**
 * Which deck zones a card may be moved to. Shared by the card grid's move
 * buttons and the Table view's Zone picker so both offer the same choices.
 */
import { describe, it, expect } from 'vitest';
import { isEquipmentCompatible, isLibraryCompatible, moveTargets } from './zone-compat';

describe('zone compatibility by card type', () => {
  it('weapons and equipment belong in the equipment zone, not the library', () => {
    expect(isEquipmentCompatible(['weapon', 'sword'])).toBe(true);
    expect(isEquipmentCompatible(['equipment', 'head'])).toBe(true);
    expect(isLibraryCompatible(['weapon', 'sword'])).toBe(false);
    expect(isLibraryCompatible(['equipment', 'head'])).toBe(false);
  });

  it('an Evo is equipment that lives in the library', () => {
    expect(isEquipmentCompatible(['evo', 'equipment', 'chest'])).toBe(false);
    expect(isLibraryCompatible(['evo', 'equipment', 'chest'])).toBe(true);
  });

  it('everything else is a library card', () => {
    expect(isLibraryCompatible(['action', 'attack'])).toBe(true);
    expect(isEquipmentCompatible(['action', 'attack'])).toBe(false);
  });
});

describe('moveTargets', () => {
  const attack = ['action', 'attack'];
  const helm = ['equipment', 'head'];

  it('a hero does not move', () => {
    expect(moveTargets('hero', ['hero'])).toEqual([]);
  });

  it('a main deck card can go to the inventory or the bench', () => {
    expect(moveTargets('maindeck', attack)).toEqual(['inventory', 'benched']);
  });

  it('equipment can go to the inventory or the bench', () => {
    expect(moveTargets('equipment', helm)).toEqual(['inventory', 'benched']);
  });

  it('from the inventory or the bench a card returns to the zone its type belongs in', () => {
    expect(moveTargets('inventory', attack)).toEqual(['maindeck', 'benched']);
    expect(moveTargets('inventory', helm)).toEqual(['equipment', 'benched']);
    expect(moveTargets('benched', attack)).toEqual(['maindeck', 'inventory']);
    expect(moveTargets('benched', helm)).toEqual(['equipment', 'inventory']);
  });

  it('never offers the zone the card is already in', () => {
    for (const zone of ['maindeck', 'equipment', 'inventory', 'benched'] as const) {
      expect(moveTargets(zone, attack)).not.toContain(zone);
    }
  });
});
