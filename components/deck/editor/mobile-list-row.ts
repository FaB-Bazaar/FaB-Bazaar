// components/deck/editor/mobile-list-row.ts
//
// Pure helpers behind the concise mobile deck-list row: quantity, pitch colour,
// name, ownership tick — and nothing else. Everything the row drops (type, class,
// cost, P/D, rarity, keywords, printings) lives in the tap-through sheet.
//
// deriveCardType still feeds the DESKTOP Type column; the mobile row carries no
// type cue since the icon set was pulled (2026-07).

/** Type words that describe structure, not class/talent. Kept in sync with the desktop row. */
const NON_CLASS_TYPE_KEYWORDS = new Set([
  'hero', 'young', 'adult', 'token', 'demi-hero', 'evo',
  'equipment', 'weapon', 'arms', 'head', 'chest', 'legs', 'off-hand',
  'one handed', 'two handed', 'one-handed', 'two-handed',
  'action', 'attack', 'instant', 'attack reaction', 'defense reaction',
]);

export { NON_CLASS_TYPE_KEYWORDS };

/**
 * Collapse a card's `types` array to the single display type.
 * Order matters: a "warrior action - attack" card is an Attack, and a card
 * carrying both `action` and `defense reaction` is a Def Reaction.
 */
export function deriveCardType(types: string[] | null | undefined): string {
  const lower = (types || []).map(t => t.toLowerCase());
  if (lower.includes('hero')) return 'Hero';
  if (lower.includes('weapon')) return 'Weapon';
  if (lower.includes('equipment')) return 'Equipment';
  if (lower.includes('attack reaction')) return 'Atk Reaction';
  if (lower.includes('defense reaction')) return 'Def Reaction';
  if (lower.includes('block')) return 'Block';
  if (lower.includes('attack')) return 'Attack';
  if (lower.includes('instant')) return 'Instant';
  if (lower.includes('action')) return 'Action';
  if (lower.includes('token')) return 'Token';
  if (lower.includes('resource')) return 'Resource';
  if (lower.includes('item')) return 'Item';
  return '';
}

export type OwnershipStatus = 'untracked' | 'full' | 'partial';

/** Collapse a card group's ownership numbers to the single tick the row shows. */
export function ownershipStatus({
  hasOwnership,
  totalOwned,
  totalQty,
}: { hasOwnership: boolean; totalOwned: number; totalQty: number }): OwnershipStatus {
  if (!hasOwnership) return 'untracked';
  return totalOwned >= totalQty ? 'full' : 'partial';
}
