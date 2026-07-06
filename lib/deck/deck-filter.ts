/**
 * Deck "type" filter for the /decks page dropdown.
 *
 * Every Decks-to-Beat deck is also flagged as a system deck (featured ⊆ system),
 * so the three options form a clean partition — each deck matches exactly one:
 *
 *   all      "My Decks"     — personal decks: not featured, not system
 *   featured "Featured"     — all Decks to Beat (featured), regardless of system
 *   system   "System only"  — system decks that are NOT featured (utility/reference)
 */
export type DeckFilterType = 'all' | 'featured' | 'system';

export function matchesDeckFilter(
  deck: { featured?: boolean; isSystemDeck?: boolean },
  filterType: DeckFilterType,
): boolean {
  switch (filterType) {
    case 'featured':
      return !!deck.featured;
    case 'system':
      return !!deck.isSystemDeck && !deck.featured;
    case 'all':
    default:
      return !deck.featured && !deck.isSystemDeck;
  }
}
