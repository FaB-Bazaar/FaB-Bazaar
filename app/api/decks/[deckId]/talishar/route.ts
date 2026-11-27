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
import { buildTalisharDeckExport } from '@/lib/talishar/deck-export';

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

    // The list the owner picked for Talishar: a saved version, or (the default)
    // the deck as it is now. Resolved in the deck service.
    const result = await deckService.findTalisharDeck(
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

    // The deck as Talishar imports it — shared with the partner play API.
    const talisharDeck = await buildTalisharDeckExport(
      deck,
      {
        // Talishar integration: apply this matchup's sideboard swaps.
        matchupId: url.searchParams.get('matchupId'),
        // Additive, gated so the response Talishar's PHP reads stays identical.
        includeArt: url.searchParams.get('includeArt') === '1',
      },
      {
        hasHeroPrinting: async (cardUniqueId) => {
          const printingResult = await printingsService.searchPrintings(
            { cardUniqueId },
            { limit: 1, sortBy: 'set', sortOrder: 'asc', show: 'all' }
          );
          return Boolean(printingResult.success && printingResult.data.printings?.[0]);
        },
      }
    );

    return NextResponse.json(talisharDeck);

  } catch (error) {
    console.error('[Talishar Export] Error exporting deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
