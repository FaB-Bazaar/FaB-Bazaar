// components/deck/editor/mobile-list-row.ts
//
// Pure helpers behind the concise mobile deck-list row: quantity, pitch colour,
// name, type icon, ownership tick — and nothing else. Everything the row drops
// (class, cost, P/D, rarity, keywords, printings) lives in the tap-through sheet.

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

export type MobileTypeKey =
  | 'attack' | 'attack-reaction' | 'defense-reaction' | 'action' | 'instant'
  | 'item' | 'equipment' | 'weapon' | 'resource' | 'hero' | 'token';

const TYPE_KEY_BY_DISPLAY: Record<string, MobileTypeKey> = {
  'Attack': 'attack',
  'Atk Reaction': 'attack-reaction',
  'Def Reaction': 'defense-reaction',
  'Block': 'defense-reaction',
  'Action': 'action',
  'Instant': 'instant',
  'Item': 'item',
  'Equipment': 'equipment',
  'Weapon': 'weapon',
  'Resource': 'resource',
  'Hero': 'hero',
  'Token': 'token',
};

/** Icon key for a derived display type, or null when there's nothing worth drawing. */
export function mobileTypeKey(displayType: string): MobileTypeKey | null {
  return TYPE_KEY_BY_DISPLAY[displayType] ?? null;
}

const TYPE_LABELS: Record<MobileTypeKey, string> = {
  'attack': 'Attack',
  'attack-reaction': 'Attack Reaction',
  'defense-reaction': 'Defense Reaction',
  'action': 'Action',
  'instant': 'Instant',
  'item': 'Item',
  'equipment': 'Equipment',
  'weapon': 'Weapon',
  'resource': 'Resource',
  'hero': 'Hero',
  'token': 'Token',
};

/** Text alternative for the icon — it is the row's only type cue (WCAG 1.1.1). */
export function mobileTypeLabel(key: MobileTypeKey): string {
  return TYPE_LABELS[key];
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
