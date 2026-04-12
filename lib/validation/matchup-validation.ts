/**
 * Matchup Validation Module
 *
 * Validates matchup sideboard configurations for deck matchups.
 * Ensures cards exist in appropriate zones and format size limits are respected.
 */

import { toTalisharIdentifier } from '@/lib/utils';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants';
import { DeckMatchup } from '@/types/deck';

/**
 * Maps pitch values to Talishar color names
 */
const PITCH_COLOR_MAP: Record<number, string> = {
  1: 'red',
  2: 'yellow',
  3: 'blue',
};

/**
 * Build set of valid hero IDs from both HERO_INFO (adult) and YOUNG_HERO_INFO (young)
 * Converts hero names to Talishar format
 */
const VALID_HERO_IDS = new Set([
  ...Object.keys(HERO_INFO).map(name => toTalisharIdentifier(name)),
  ...Object.keys(YOUNG_HERO_INFO).map(name => toTalisharIdentifier(name)),
]);

/**
 * Card availability context for validation
 */
interface ValidationContext {
  /** Main deck cards (hero + equipment + maindeck), by talisharId -> total quantity */
  mainDeckCards: Map<string, number>;

  /** Sideboard cards (inventory), by talisharId -> total quantity */
  sideboardCards: Map<string, number>;

  /** Total main deck card count */
  mainDeckTotal: number;
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Format-specific exact library size requirement after sideboarding.
 * Silver Age: must be exactly 40 library cards.
 * Blitz: must be exactly 40 library cards.
 * Classic Constructed is handled separately (max 80, not exact).
 * Other formats: no restriction.
 */
function getFormatExactLibrary(format?: string): number | null {
  if (!format) return null;
  const f = format.toLowerCase();
  if (f === 'silver age' || f === 'sage' || f === 'blitz') return 40;
  return null;
}

/**
 * Validates a matchup configuration
 *
 * Rules:
 * 1. Hero ID must be valid (from HERO_INFO)
 * 2. Turn order must be valid enum or null
 * 3. Notes max 500 characters
 * 4. Cards in `in[]` must exist in sideboard (inventory) with sufficient quantity
 * 5. Cards in `out[]` must exist in main deck with sufficient quantity
 * 6. Format size: post-swap deck must not exceed format limit (Silver Age: 40)
 *
 * Note: in/out counts do NOT need to be equal.
 *
 * @param matchup - The matchup to validate
 * @param deck - The deck to validate against
 * @returns Validation result with errors if invalid
 */
export function validateMatchup(
  matchup: DeckMatchup,
  deck: any
): ValidationResult {
  const errors: string[] = [];

  // 1. Hero ID validation ("core" is a special reserved ID for baseline list)
  if (!matchup.heroId || (matchup.heroId !== 'core' && !VALID_HERO_IDS.has(matchup.heroId))) {
    errors.push(`Invalid hero ID: ${matchup.heroId}`);
  }

  // 2. Turn order validation
  const validTurnOrders: Array<string | null> = ["First", "Second", "NoPreference", null];
  if (!validTurnOrders.includes(matchup.preferredTurnOrder)) {
    errors.push(`Invalid turn order: ${matchup.preferredTurnOrder}`);
  }

  // 3. Notes validation
  if (matchup.notes && matchup.notes.length > 500) {
    errors.push("Notes exceed 500 character limit");
  }

  // 4. Build card availability context
  const context = buildValidationContext(deck);

  // 5. Validate IN cards (must exist in sideboard) — deduplicate for quantity check
  const inCounts = new Map<string, number>();
  matchup.sideboard.in.forEach(id => inCounts.set(id, (inCounts.get(id) || 0) + 1));
  for (const [cardId, required] of inCounts) {
    const available = context.sideboardCards.get(cardId) || 0;
    if (available < required) {
      errors.push(
        `Card '${cardId}' - need ${required} copies in sideboard, only ${available} available`
      );
    }
  }

  // 6. Validate OUT cards (must exist in main deck) — deduplicate for quantity check
  const outCounts = new Map<string, number>();
  matchup.sideboard.out.forEach(id => outCounts.set(id, (outCounts.get(id) || 0) + 1));
  for (const [cardId, required] of outCounts) {
    const available = context.mainDeckCards.get(cardId) || 0;
    if (available < required) {
      errors.push(
        `Card '${cardId}' - need ${required} copies in main deck, only ${available} available`
      );
    }
  }

  // 7. Format size validation
  const exactLibrary = getFormatExactLibrary(deck.format);
  if (exactLibrary !== null) {
    const outCount = matchup.sideboard.out.length;
    const inCount = matchup.sideboard.in.length;
    const postSwapSize = context.mainDeckTotal - outCount + inCount;
    if (postSwapSize !== exactLibrary) {
      errors.push(
        `${deck.format} deck must be exactly ${exactLibrary} cards after sideboard (would be ${postSwapSize} cards)`
      );
    }
  }

  // 8. Classic Constructed / Living Legend: post-swap deck must be 60–80 cards
  const format = deck.format?.toLowerCase();
  if (format === 'classic constructed' || format === 'cc' || format === 'living legend') {
    const outCount = matchup.sideboard.out.length;
    const inCount = matchup.sideboard.in.length;
    const postSwapSize = context.mainDeckTotal - outCount + inCount;
    if (postSwapSize < 60) {
      errors.push(
        `${deck.format} deck must have at least 60 cards after sideboard (would be ${postSwapSize} cards)`
      );
    } else if (postSwapSize > 80) {
      errors.push(
        `${deck.format} deck cannot exceed 80 cards after sideboard (would be ${postSwapSize} cards)`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Builds validation context from deck structure
 *
 * @param deck - The deck to build context from
 * @returns Validation context with card availability maps
 */
function buildValidationContext(deck: any): ValidationContext {
  const mainDeckCards = new Map<string, number>();
  const sideboardCards = new Map<string, number>();
  let mainDeckTotal = 0;

  // Count main deck cards (hero + equipment + maindeck) — respect quantity field
  [...(deck.hero || []), ...(deck.equipment || []), ...(deck.maindeck || [])].forEach(printing => {
    const cardId = buildTalisharIdentifier(printing, printing.printingId);
    const qty = printing.quantity || 1;
    mainDeckCards.set(cardId, (mainDeckCards.get(cardId) || 0) + qty);
    mainDeckTotal += qty;
  });

  // Count sideboard cards (inventory) — respect quantity field
  (deck.inventory || []).forEach((printing: any) => {
    const cardId = buildTalisharIdentifier(printing, printing.printingId);
    const qty = printing.quantity || 1;
    sideboardCards.set(cardId, (sideboardCards.get(cardId) || 0) + qty);
  });

  return { mainDeckCards, sideboardCards, mainDeckTotal };
}

/**
 * Builds a Talishar-compatible card identifier from printing details
 * Format: {card_name}_{pitch_color} or just {card_name} if no pitch
 *
 * NOTE: Must match the logic in app/api/decks/[deckId]/talishar/route.ts
 *
 * @param printing - The printing object
 * @param fallbackId - Fallback identifier if name is missing
 * @returns Talishar identifier
 */
function buildTalisharIdentifier(printing: any, fallbackId: string): string {
  const cardName = printing.printingDetails?.name || '';
  const baseIdentifier = toTalisharIdentifier(cardName) || fallbackId;

  // Handle pitch value - can be direct number or MongoDB $numberInt wrapper
  const pitchValue = printing.printingDetails?.pitch;
  let pitch: number | null = null;

  if (typeof pitchValue === 'number') {
    pitch = pitchValue;
  } else if (pitchValue && typeof pitchValue === 'object' && '$numberInt' in pitchValue) {
    pitch = parseInt(pitchValue.$numberInt, 10);
  }

  // Append pitch color if present
  if (pitch && PITCH_COLOR_MAP[pitch]) {
    return `${baseIdentifier}_${PITCH_COLOR_MAP[pitch]}`;
  }

  return baseIdentifier;
}

/**
 * Sanitizes all matchups in a deck, stripping stale sideboard entries.
 * Returns { matchups, changed } — `changed` is true if any matchup was modified.
 */
export function sanitizeAllMatchups(
  matchups: DeckMatchup[],
  deck: any
): { matchups: DeckMatchup[]; changed: boolean } {
  let changed = false;
  const sanitized = matchups.map(m => {
    const s = sanitizeMatchup(m, deck);
    if (
      s.sideboard.in.length !== m.sideboard.in.length ||
      s.sideboard.out.length !== m.sideboard.out.length
    ) {
      changed = true;
    }
    return s;
  });
  return { matchups: sanitized, changed };
}

/**
 * Strips stale sideboard entries that reference cards no longer in the correct zone.
 * - `in` entries for cards not in inventory are removed
 * - `out` entries for cards not in maindeck are removed
 *
 * Use this before validateMatchup when deck composition may have changed since
 * the matchup was last saved (e.g. cards removed from inventory/maindeck).
 */
export function sanitizeMatchup(matchup: DeckMatchup, deck: any): DeckMatchup {
  const context = buildValidationContext(deck);

  const inCounts = new Map<string, number>();
  const sanitizedIn: string[] = [];
  for (const id of matchup.sideboard.in) {
    const used = inCounts.get(id) || 0;
    const available = context.sideboardCards.get(id) || 0;
    if (used < available) {
      sanitizedIn.push(id);
      inCounts.set(id, used + 1);
    }
  }

  const outCounts = new Map<string, number>();
  const sanitizedOut: string[] = [];
  for (const id of matchup.sideboard.out) {
    const used = outCounts.get(id) || 0;
    const available = context.mainDeckCards.get(id) || 0;
    if (used < available) {
      sanitizedOut.push(id);
      outCounts.set(id, used + 1);
    }
  }

  return {
    ...matchup,
    sideboard: { in: sanitizedIn, out: sanitizedOut },
  };
}

export { VALID_HERO_IDS };
