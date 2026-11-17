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
