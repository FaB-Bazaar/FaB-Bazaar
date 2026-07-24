// Pure helpers for the matchup sideboard gallery (DeckMatchupsDialog).
// Apply a matchup's sideboard swaps to the base deck / inventory piles,
// preserving every card's imageUrl so the gallery never falls back to card backs.

export interface MatchupGalleryCard {
  talisharId: string;
  count: number;
  displayName: string;
  printingId: string;
  imageUrl?: string;
}

export interface SideboardSwaps {
  in: string[];
  out: string[];
}

function hasSwaps(sideboard: SideboardSwaps | undefined): sideboard is SideboardSwaps {
  return !!sideboard && (sideboard.in.length > 0 || sideboard.out.length > 0);
}

function applySwaps(
  base: MatchupGalleryCard[],
  other: MatchupGalleryCard[],
  removals: string[],
  additions: string[]
): MatchupGalleryCard[] {
  const countMap = new Map<string, MatchupGalleryCard>();
  for (const c of base) {
    countMap.set(c.talisharId, { ...c });
  }
  for (const id of removals) {
    const entry = countMap.get(id);
    if (entry) {
      entry.count -= 1;
      if (entry.count <= 0) countMap.delete(id);
    }
  }
  for (const id of additions) {
    const existing = countMap.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      const source = other.find(c => c.talisharId === id);
      countMap.set(id, {
        talisharId: id,
        count: 1,
        displayName: source?.displayName ?? id,
        printingId: source?.printingId ?? id,
        imageUrl: source?.imageUrl,
      });
    }
  }
  return Array.from(countMap.values());
}

// Post-sideboard deck: sideboard.out leaves the deck, sideboard.in enters from inventory.
export function applySideboardToDeck(
  deckCards: MatchupGalleryCard[],
  inventoryCards: MatchupGalleryCard[],
  sideboard: SideboardSwaps | undefined
): MatchupGalleryCard[] {
  if (!hasSwaps(sideboard)) return deckCards;
  return applySwaps(deckCards, inventoryCards, sideboard.out, sideboard.in);
}

// Set-aside pile: sideboard.in leaves inventory (into the deck), sideboard.out enters from the deck.
export function applySideboardToInventory(
  inventoryCards: MatchupGalleryCard[],
  deckCards: MatchupGalleryCard[],
  sideboard: SideboardSwaps | undefined
): MatchupGalleryCard[] {
  if (!hasSwaps(sideboard)) return inventoryCards;
  return applySwaps(inventoryCards, deckCards, sideboard.in, sideboard.out);
}
