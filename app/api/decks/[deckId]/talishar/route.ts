// app/api/decks/[deckId]/talishar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService, printingsService } from '@/lib/services';
import { validateTalisharRequest, validateTalisharHmac } from '@/lib/middleware/talishar-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://talishar.net',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
import { toTalisharIdentifier } from '@/lib/utils';
import { HERO_INFO, YOUNG_HERO_INFO, getTalisharHeroSlug } from '@/lib/fab-constants';

/**
 * Maps FaB Bazaar deck formats to Talishar format codes
 */
const FORMAT_MAP: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Future Classic Constructed': 'cc', // CC rules; Talishar has no future-pool format
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
  // Split on ' // ' (FaB double-faced card separator) and convert each face separately,
  // then rejoin with '__' — Talishar requires double underscore between faces.
  // e.g. "comet storm // shock" → "comet_storm__shock_red"
  const parts = cardName.split(' // ');
  const baseIdentifier =
    parts.map((p: string) => toTalisharIdentifier(p)).filter(Boolean).join('__') || fallbackId;

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
    const resolvedParamsDebug = await params;
    console.warn('[Talishar Webhook] Incoming POST', {
      deckId: resolvedParamsDebug.deckId,
      userAgent: request.headers.get('user-agent'),
      hasApiKey: !!(request.headers.get('x-api-key') || request.headers.get('x-talishar-key') || new URL(request.url).searchParams.get('api_key')),
    });

    const validation = await validateTalisharRequest(request);
    if (!validation.valid) {
      return validation.response;
    }

    const resolvedParams = await params;
    const publicId = resolvedParams.deckId;
    const body = await request.json();

    // Validate the URL's deck exists (keeps the 200 OK guarantee for Talishar)
    const deckLookup = await deckService.findByPublicId(publicId, undefined);
    if (!deckLookup.success || !deckLookup.data) {
      console.warn('[Talishar Webhook] Unknown deck, discarding', { publicId });
      return NextResponse.json({ success: true, received: true });
    }

    // Process both deck entries. deckbuilderID presence = player consented to tracking.
    // Talishar strips deckbuilderID when a player opts out (functions.inc.php:969).
    const candidates = (
      [
        { entry: body.deck1, opponent: body.deck2 },
        { entry: body.deck2, opponent: body.deck1 },
      ] as const
    ).filter(({ entry }) => !!entry?.deckbuilderID);

    console.warn('[Talishar Webhook] Processing entries', {
      publicId,
      candidates: candidates.map(({ entry }) => ({
        deckbuilderID: entry.deckbuilderID,
        hero: entry.playerHero,
        result: entry.result,
      })),
    });

    const saveResults = await Promise.all(
      candidates.map(async ({ entry, opponent }) => {
        const lookup = await deckService.findByPublicId(entry.deckbuilderID as string, undefined);
        if (!lookup.success || !lookup.data) {
          console.warn('[Talishar Webhook] No FaB Bazaar deck for deckbuilderID', {
            deckbuilderID: entry.deckbuilderID,
          });
          return null;
        }
        return gameResultsService.createGameResult(lookup.data._id, body, entry, opponent);
      })
    );

    if (saveResults.some(r => r && !r.success)) {
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
    // 1. Authenticate: browser (Talishar frontend) uses HMAC, backend uses API key
    const resolvedParams = await params;
    const url = new URL(request.url);
    const metafyHash = url.searchParams.get('metafyHash');
    const timestamp = url.searchParams.get('timestamp');

    if (metafyHash && timestamp) {
      // Browser path: HMAC signed with deckId + FABBAZAAR_SALT + timestamp
      const hmacResult = validateTalisharHmac(resolvedParams.deckId, metafyHash, timestamp, CORS_HEADERS);
      if (!hmacResult.valid) return hmacResult.response;
    } else {
      // Backend path: static API key
      const validation = await validateTalisharRequest(request);
      if (!validation.valid) return validation.response;
    }

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

    // Process hero cards (main deck) — use exact Talishar slug when available
    deck.hero.forEach(printing => {
      const heroName = (printing.printingDetails?.name || '').toLowerCase();
      const cardId = getTalisharHeroSlug(heroName) || buildTalisharIdentifier(printing, printing.printingId);
      const existing = cardCounts.get(cardId) || { total: 0, sideboardTotal: 0 };
      existing.total += printing.quantity || 1;
      cardCounts.set(cardId, existing);
    });

    // Fallback: if no hero printing in deck.hero but heroName is set, look up the
    // earliest printing so Talishar can display the hero image.
    if (deck.hero.length === 0 && deck.heroName) {
      const heroKey = deck.heroName.toLowerCase();
      const heroInfo = HERO_INFO[heroKey as keyof typeof HERO_INFO]
        ?? YOUNG_HERO_INFO[heroKey as keyof typeof YOUNG_HERO_INFO];
      if (heroInfo?.cardUniqueId) {
        const printingResult = await printingsService.searchPrintings(
          { cardUniqueId: heroInfo.cardUniqueId },
          { limit: 1, sortBy: 'set', sortOrder: 'asc', show: 'all' }
        );
        if (printingResult.success && printingResult.data.printings?.[0]) {
          const identifier = getTalisharHeroSlug(heroKey) || toTalisharIdentifier(heroKey) || heroKey.replace(/\s+/g, '_');
          const existing = cardCounts.get(identifier) || { total: 0, sideboardTotal: 0 };
          existing.total += 1;
          cardCounts.set(identifier, existing);
        }
      }
    }

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
    const matchupId = url.searchParams.get('matchupId');

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

    // Optional art map for graphical clients (?includeArt=1).
    //
    // Talishar's game state identifies cards by collector number only, with no
    // printing info — so a client that wants to render the player's *actual*
    // printings (foils, alt arts) needs collector_number -> image_url for this
    // deck. Everything required is already selected by the deck service; this
    // adds no queries.
    //
    // Additive and gated behind the query param so the response Talishar's PHP
    // consumes in production stays byte-identical. Known limit: Talishar picks
    // its own canonical printing per identifier, so if it reports a reprint's
    // collector number the map misses that card — clients should fall back to
    // Talishar's own card images on a miss.
    const includeArt = url.searchParams.get('includeArt') === '1';
    let art: Record<string, string> | undefined;
    if (includeArt) {
      art = {};
      for (const printing of [...deck.hero, ...deck.equipment, ...deck.maindeck, ...deck.inventory]) {
        const collector = printing.printingDetails?.collector_number;
        const imageUrl = printing.printingDetails?.image_url;
        if (collector && imageUrl) art[collector] = imageUrl;
      }
    }

    // Build Talishar response
    const talisharDeck = {
      name: deck.name,
      ...(deck.format && { format: FORMAT_MAP[deck.format] || deck.format.toLowerCase() }),
      cards,
      ...(validMatchups.length > 0 && { matchups: validMatchups }),
      ...(art && { art })
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
