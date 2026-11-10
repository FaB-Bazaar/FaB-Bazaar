// Which deck zones a card may live in / be moved to. One copy for the card
// grid's move buttons and the Table view's Zone picker.

export type MovableZone = 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'benched';

/** Weapons and (non-Evo) equipment go in the equipment zone. */
export function isEquipmentCompatible(types: string[]): boolean {
  const isEvo = types.includes('evo');
  return types.includes('weapon') || (!isEvo && types.includes('equipment'));
}

/** Everything that is not a weapon or (non-Evo) equipment goes in the library. */
export function isLibraryCompatible(types: string[]): boolean {
  const isEvo = types.includes('evo');
  if (types.includes('weapon')) return false;
  if (!isEvo && types.includes('equipment')) return false;
  return true;
}

/** The zones a card in `zone` may move to, in the order to offer them. */
export function moveTargets(zone: MovableZone, types: string[]): MovableZone[] {
  if (zone === 'hero') return [];
  const home: MovableZone[] = [];
  if (isEquipmentCompatible(types)) home.push('equipment');
  if (isLibraryCompatible(types)) home.push('maindeck');
  return [...home, 'inventory' as const, 'benched' as const].filter(z => z !== zone);
}
