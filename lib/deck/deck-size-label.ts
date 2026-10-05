// Deck header size: the deck proper, the inventory called out separately, and
// the sum so nobody has to add them up by hand.
export function deckSizeLabel(main: number, inventory: number): string {
  return inventory ? `${main} cards + ${inventory} inventory (${main + inventory} total)` : `${main} cards`;
}
