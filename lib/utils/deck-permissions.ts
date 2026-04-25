export interface DeckOwnership {
  userId: string | null | undefined;
  coOwners?: string[] | null;
}

export function canEditDeck(
  deck: DeckOwnership,
  userId: string | null | undefined
): boolean {
  if (!userId || !deck.userId) return false;
  if (deck.userId === userId) return true;
  return Array.isArray(deck.coOwners) && deck.coOwners.includes(userId);
}
