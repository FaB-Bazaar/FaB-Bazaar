import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

/** Zones the mobile Cards tab can be pointed at; null = infer from the card. */
export type MobileAddZone = Extract<DeckCategory, 'maindeck' | 'inventory' | 'benched'> | null;

export interface DeckSlotRef {
  printingId: string;
  quantity: number;
  category: DeckCategory;
}

function cardTypes(card: { types?: string[] | null }): string[] {
  return (card.types ?? []).map(t => t.toLowerCase());
}

/**
 * Where a tap on + in the mobile Cards tab sends the card. A hero is always the
 * hero; the bench and inventory zones take the card as-is (that is the whole
 * point of picking them); the maindeck default keeps inferring equipment from
 * the card type, like the tab did before zones existed.
 */
export function resolveMobileAddCategory(zone: MobileAddZone, card: { types?: string[] | null }): DeckCategory {
  const types = cardTypes(card);
  if (types.includes('hero')) return 'hero';
  if (zone === 'benched' || zone === 'inventory') return zone;
  if (types.some(t => t === 'equipment' || t === 'weapon')) return 'equipment';
  return 'maindeck';
}

/** The copy a tap on − removes: the active zone's copy when there is one. */
export function pickRemovalSlot<T extends DeckSlotRef>(slots: T[], zone: MobileAddZone): T | undefined {
  if (zone) {
    const inZone = slots.find(s => s.category === zone);
    if (inZone) return inZone;
  }
  return slots[0];
}
