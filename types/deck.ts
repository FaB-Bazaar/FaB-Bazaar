/**
 * Deck Matchup Types
 *
 * Matchup sideboard configuration for Talishar integration.
 * Enables competitive players to pre-plan sideboard strategies
 * for specific opponent heroes.
 */

/**
 * Matchup sideboard configuration for a specific opponent hero
 */
export interface DeckMatchup {
  /** Opponent hero identifier in Talishar format (e.g., "briar_warden_of_thorns") */
  heroId: string;

  /** Preferred turn order: go first, second, or no preference */
  preferredTurnOrder: "First" | "Second" | "NoPreference" | null;

  /** Strategy notes (max 500 characters) */
  notes: string | null;

  /** Sideboard swap configuration */
  sideboard: {
    /** Card identifiers to sideboard IN (from inventory) */
    in: string[];

    /** Card identifiers to sideboard OUT (from main deck) */
    out: string[];
  };
}

/**
 * Deck metadata structure
 * Stored in deck.metadata field
 */
export interface DeckMetadata {
  /** Matchup configurations */
  matchups?: DeckMatchup[];

  /** Allow other metadata fields */
  [key: string]: any;
}
