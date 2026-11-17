import { FOILING_MAP } from '@/lib/fab-constants';
import { formatPrice } from '@/lib/pricing/price-source';

/**
 * Shape of a binder trade-request cart entry (what TradeRequestSidebar /
 * MobileTradeRequestSheet read). Built from a binder card (InventoryCardDTO).
 */
export function toTradeCartEntry(card: any, quantity = 1): any {
  const id = card.id || card._id;
  const maxQuantity = card.quantity;
  return {
    ...card,
    id,
    quantity: Math.max(1, Math.min(quantity, maxQuantity)),
    maxQuantity,
    printingId:
      card.printingId ||
      card.printingDetails?.printing_id ||
      card.printingDetails?.unique_id ||
      id,
    name: card.name || card.display_name,
    printingDetails: card.printingDetails,
    priority: 'medium',
    notes: '',
  };
}

/**
 * Add the "Add my wants" results to the cart. Cards already in the cart keep
 * their entry; their quantity is raised to the wanted amount, never lowered.
 */
export function mergeWantedIntoCart(
  cart: any[],
  wanted: Array<{ requestQuantity: number } & Record<string, any>>
): { cart: any[]; added: number } {
  const next = [...cart];
  let added = 0;
  for (const item of wanted) {
    const id = item.id || item._id;
    const index = next.findIndex((c) => c.id === id);
    if (index === -1) {
      next.push(toTradeCartEntry(item, item.requestQuantity));
      added++;
    } else if (next[index].quantity < item.requestQuantity) {
      next[index] = {
        ...next[index],
        quantity: Math.min(item.requestQuantity, next[index].maxQuantity),
      };
    }
  }
  return { cart: next, added };
}

/** The card's price — tcg_low only (binder cards carry it top-level). */
export function tradeCartPrice(card: any): number | null {
  const price = card.tcg_low ?? card.printingDetails?.tcg_low;
  return price == null ? null : Number(price);
}

/** Copies and tcg_low value of a trade cart; unpriced = entries with no tcg_low. */
export function tradeCartTotals(cart: any[]): { copies: number; value: number; unpriced: number } {
  let copies = 0;
  let value = 0;
  let unpriced = 0;
  for (const card of cart) {
    copies += card.quantity;
    const price = tradeCartPrice(card);
    if (price == null) unpriced++;
    else value += price * card.quantity;
  }
  return { copies, value, unpriced };
}

/** "IAR229 · Rainbow Foil" — collector number (or set) plus foiling; non-foil omitted. */
export function tradeCardDetails(card: any): string {
  const set = card.collector_number || card.set?.toUpperCase();
  const foil = FOILING_MAP[String(card.foiling || '').toLowerCase() as keyof typeof FOILING_MAP];
  return [set, foil && foil !== 'Non-foil' ? foil : null].filter(Boolean).join(' · ');
}

/** "$22.00 × 2 = $44.00" from tcg_low, or "No price". */
export function tradeCardPriceLine(card: any): string {
  const price = tradeCartPrice(card);
  if (price == null) return 'No price';
  return `${formatPrice(price, 'tcgplayer')} × ${card.quantity} = ${formatPrice(price * card.quantity, 'tcgplayer')}`;
}
