// app/api/decks/[deckId]/talishar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService } from '@/lib/services';
import { validateTalisharRequest } from '@/lib/middleware/talishar-auth';
import { toTalisharIdentifier } from '@/lib/utils';
import { HERO_INFO } from '@/lib/fab-constants';

/**
 * Maps FaB Bazaar deck formats to Talishar format codes
 */
const FORMAT_MAP: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Silver Age': 'sage',
  'Blitz': 'blitz',
  'Commoner': 'commoner',
  'Living Legend': 'cc', // Living Legend uses CC rules
  'Limited': 'draft',
  'Ultimate Pit Fight': 'upf',
  'Casual': 'open',
};

/**
 * Maps pitch values to Talishar color names
 * MongoDB stores pitch as number or { $numberInt: "1" }
 */
const PITCH_COLOR_MAP: Record<number, string> = {
  1: 'red',
  2: 'yellow',
  3: 'blue',
};

/**
 * Builds a Talishar-compatible card identifier from printing details
 * Format: {card_name}_{pitch_color} or just {card_name} if no pitch
 *
 * Examples:
 * - "throttle" with pitch 1 -> "throttle_red"
 * - "enlightened strike" with pitch 1 -> "enlightened_strike_red"
 * - "banksy" with no pitch -> "banksy"
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
 * Converts a heroId (short name) to a display name
 * Examples:
 * - "azalea" -> "Azalea"
 * - "briar" -> "Briar"
 * - "dorinthea_ironsong" -> "Dorinthea"
 */
function getHeroDisplayName(heroId: string): string {
  // Handle young heroes (format: hero_name without full title)
  // e.g., "azalea" instead of "azalea_ace_in_the_hole"
  const cleanHeroId = heroId.replace(/_/g, ' ').toLowerCase();

  // Find matching hero in HERO_INFO by shortName
  for (const [fullName, info] of Object.entries(HERO_INFO)) {
    if (info.shortName === heroId || info.shortName === cleanHeroId) {
      // Return just the first part (hero name without title)
      // e.g., "Azalea, Ace in the Hole" -> "Azalea"
      const parts = fullName.split(',');
      return parts[0].split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
  }

  // Fallback: capitalize the heroId
  return heroId
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Applies sideboard swaps to a cards array
 * Used when matchupId query parameter is provided
 *
 * @param cards - Array of card objects with total and sideboardTotal
 * @param sideboard - Sideboard swap configuration { in: [], out: [] }
 * @returns Modified cards array with sideboard applied
 */
function applySideboardSwap(
  cards: Array<{ identifier: string; total: number; sideboardTotal?: number }>,
  sideboard: { in: string[]; out: string[] }
): Array<{ identifier: string; total: number; sideboardTotal?: number }> {
  // Create a deep copy to avoid modifying the original
  const result = cards.map(card => ({ ...card }));

  // Create a map for faster lookups
  const cardMap = new Map(result.map(card => [card.identifier, card]));

  // Remove cards from main deck (move to sideboard)
  sideboard.out.forEach(cardId => {
    const card = cardMap.get(cardId);
    if (card && card.total > 0) {
      card.total--;
      card.sideboardTotal = (card.sideboardTotal || 0) + 1;
    }
  });

  // Add cards from sideboard to main deck
  sideboard.in.forEach(cardId => {
    const card = cardMap.get(cardId);
    if (card && (card.sideboardTotal || 0) > 0) {
      card.sideboardTotal = card.sideboardTotal! - 1;
      card.total++;
    }
  });

  return result;
}

/**
 * GET /api/decks/[deckId]/talishar
 *
 * Exports a deck in Talishar-compatible JSON format for external integration.
 *
 * Authentication:
 * - Requires Talishar API key (x-api-key header or api_key query param)
 * - Valid API key grants access to all decks (public and private)
 * - Rate limited to 100 requests/minute per API key
 *
 * Talishar Format:
 * {
 *   "name": "Deck Name",
 *   "format": "cc",  // Optional: cc, blitz, commoner, etc.
 *   "cards": [
 *     {
 *       "total": 3,              // Required: copies in main deck
 *       "sideboardTotal": 0,     // Optional: defaults to 0
 *       "identifier": "card_id"  // Required: derived from card name in underscore format
 *     }
 *   ]
 * }
 */
/**
 * POST /api/decks/[deckId]/talishar
 *
 * Receives game result stats from Talishar after a completed game.
 * Mirrors the FaBInsights payload shape. No auth required (data is public/open-source).
 *
 * Expected payload:
 * {
 *   gameID, gameName, player1Name, player2Name, format, gameGUID, conceded,
 *   countWinnerDeck, countLoserDeck,
 *   deck1: { deckId, turns, result, winner, firstPlayer, playerHero, opposingHero,
 *             deckbuilderID, cardResults, character, tokenResults, arenaCardResults,
 *             turnResults, totalDamageDealt, ... },
 *   deck2: { ...same shape... }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const validation = await validateTalisharRequest(request);
    if (!validation.valid) {
      return validation.response;
    }

    const resolvedParams = await params;
    const publicId = resolvedParams.deckId;
    const body = await request.json();

    // Resolve publicId → internal deck id (game_results.deck_id is a FK to decks.id)
    const deckLookup = await deckService.findByPublicId(publicId, undefined);
    if (!deckLookup.success || !deckLookup.data) {
      // Deck doesn't exist in FaB Bazaar — acknowledge so Talishar doesn't retry
      return NextResponse.json({ success: true, received: true });
    }
    const internalDeckId = deckLookup.data._id;

    // Find which deck entry (deck1 or deck2) belongs to this FaB Bazaar deck
    const deckEntry = body.deck1?.deckbuilderID === publicId || body.deck1?.deckbuilderID?.endsWith(`/${publicId}`)
      ? body.deck1
      : body.deck2?.deckbuilderID === publicId || body.deck2?.deckbuilderID?.endsWith(`/${publicId}`)
        ? body.deck2
        : body.deck1; // fallback to deck1 if we can't match

    const result = await gameResultsService.createGameResult(internalDeckId, body, deckEntry);

    if (!result.success) {
      console.error(`[Talishar Stats] Failed to save game result for deck ${deckId}:`, result.error);
      return NextResponse.json({ error: 'Failed to save game result' }, { status: 500 });
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error('[Talishar Stats] Error receiving game result:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    // 1. Validate Talishar API request (API key + rate limiting)
    const validation = await validateTalisharRequest(request);
    if (!validation.valid) {
      return validation.response;
    }

    const resolvedParams = await params;
    const url = new URL(request.url);

    // Check authentication (optional for public decks)
    const authResult = await authenticateRequest(request, {});

    // Fetch deck using service layer
    const result = await deckService.findByPublicId(
      resolvedParams.deckId,
      authResult.success ? authResult.userId : undefined
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 404 });
    }

    const deck = result.data;

    if (!deck) {
      return NextResponse.json({
        success: false,
        error: 'Deck not found'
      }, { status: 404 });
    }

    // Build card counts map
    // Main deck = hero + equipment + maindeck
    // Sideboard = inventory
    const cardCounts = new Map<string, { total: number; sideboardTotal: number }>();

    // Process hero cards (main deck)
    deck.hero.forEach(printing => {
      const cardId = buildTalisharIdentifier(printing, printing.printingId);
      const existing = cardCounts.get(cardId) || { total: 0, sideboardTotal: 0 };
      existing.total += printing.quantity || 1;
      cardCounts.set(cardId, existing);
    });

    // Process equipment cards (main deck)
    deck.equipment.forEach(printing => {
      const cardId = buildTalisharIdentifier(printing, printing.printingId);
      const existing = cardCounts.get(cardId) || { total: 0, sideboardTotal: 0 };
      existing.total += printing.quantity || 1;
      cardCounts.set(cardId, existing);
    });

    // Process main deck cards
    deck.maindeck.forEach(printing => {
      const cardId = buildTalisharIdentifier(printing, printing.printingId);
      const existing = cardCounts.get(cardId) || { total: 0, sideboardTotal: 0 };
      existing.total += printing.quantity || 1;
      cardCounts.set(cardId, existing);
    });

    // Process inventory cards (sideboard)
    deck.inventory.forEach(printing => {
      const cardId = buildTalisharIdentifier(printing, printing.printingId);
      const existing = cardCounts.get(cardId) || { total: 0, sideboardTotal: 0 };
      existing.sideboardTotal += printing.quantity || 1;
      cardCounts.set(cardId, existing);
    });

    // Build Talishar cards array
    let cards = Array.from(cardCounts.entries()).map(([identifier, counts]) => ({
      identifier,
      total: counts.total,
      ...(counts.sideboardTotal > 0 && { sideboardTotal: counts.sideboardTotal })
    }));

    // Process matchups from metadata (optional field)
    const matchups = deck.metadata?.matchups || [];

    // Validate and transform matchups (lenient validation)
    const validMatchups = matchups
      .filter((matchup: any) => {
        // Basic structure validation
        if (!matchup.heroId || !matchup.sideboard) {
          console.warn(
            `[Talishar Export] Skipping invalid matchup for deck ${deck.publicId}`
          );
          return false;
        }
        if (!Array.isArray(matchup.sideboard.in) || !Array.isArray(matchup.sideboard.out)) {
          console.warn(
            `[Talishar Export] Skipping matchup with invalid sideboard arrays`
          );
          return false;
        }
        return true;
      })
      .map((matchup: any) => ({
        id: matchup.heroId,          // Talishar expects "id" field
        matchupId: matchup.heroId,   // FaB Bazaar frontend expects matchupId
        heroId: matchup.heroId,      // Keep for backwards compatibility
        name: getHeroDisplayName(matchup.heroId),
        preferredTurnOrder: matchup.preferredTurnOrder || null,
        notes: matchup.notes || null,
        sideboard: {
          in: matchup.sideboard.in || [],
          out: matchup.sideboard.out || []
        }
      }));

    // Check for matchupId query parameter (Talishar integration)
    // When present, apply the corresponding sideboard swap to the deck
    const requestUrl = new URL(request.url);
    const matchupId = requestUrl.searchParams.get('matchupId');

    if (matchupId && validMatchups.length > 0) {
      // Find the requested matchup
      const selectedMatchup = validMatchups.find(
        m => m.matchupId === matchupId || m.heroId === matchupId
      );

      if (selectedMatchup) {
        console.log(
          `[Talishar Export] Applying sideboard for matchup: ${selectedMatchup.name} (${matchupId})`
        );
        // Apply sideboard swap
        cards = applySideboardSwap(cards, selectedMatchup.sideboard);
      } else {
        console.warn(
          `[Talishar Export] Matchup not found: ${matchupId} for deck ${deck.publicId}`
        );
      }
    }

    // Build Talishar response
    const talisharDeck = {
      name: deck.name,
      ...(deck.format && { format: FORMAT_MAP[deck.format] || deck.format.toLowerCase() }),
      cards,
      ...(validMatchups.length > 0 && { matchups: validMatchups })
    };

    return NextResponse.json(talisharDeck);

  } catch (error) {
    console.error('[Talishar Export] Error exporting deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
