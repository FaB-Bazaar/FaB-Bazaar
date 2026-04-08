// app/api/decks/[deckId]/matchups/[heroId]/route.ts
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';
import { validateMatchup, sanitizeMatchup } from '@/lib/validation/matchup-validation';
import { DeckMatchup } from '@/types/deck';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://talishar.net',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HASH_MAX_AGE_SECS = 300; // 5 minutes

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * PATCH /api/decks/[deckId]/matchups/[heroId]
 *
 * Talishar-initiated upsert of a matchup's sideboard.
 * Updates the sideboard (in/out cards) if the matchup exists; creates it if it doesn't.
 * Preserves notes and preferredTurnOrder on existing matchups.
 *
 * Authentication: Hash-based (metafyId + FABBAZAAR_SALT + timestamp → SHA-256).
 * Called directly from the Talishar frontend — no API key required.
 *
 * Query params: ?metafyId=<uuid>&metafyHash=<sha256hex>&timestamp=<unix_secs>
 *
 * Request Body:
 * {
 *   "sideboard": {
 *     "in": ["card_id_1"],
 *     "out": ["card_id_2"]
 *   }
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { deckId: string; heroId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const metafyId = searchParams.get('metafyId');
    const metafyHash = searchParams.get('metafyHash');
    const timestamp = searchParams.get('timestamp');

    if (!metafyId || !metafyHash || !timestamp) {
      return NextResponse.json(
        { success: false, error: 'metafyId, metafyHash, and timestamp are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate timestamp freshness
    const salt = process.env.FABBAZAAR_SALT;
    if (!salt) {
      console.error('[Matchup Patch] FABBAZAAR_SALT not configured');
      return NextResponse.json(
        { success: false, error: 'Server misconfiguration' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const ts = parseInt(timestamp, 10);
    const nowSecs = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSecs - ts) > HASH_MAX_AGE_SECS) {
      return NextResponse.json(
        { success: false, error: 'Timestamp expired' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Validate hash
    const expectedHash = crypto
      .createHash('sha256')
      .update(metafyId + salt + timestamp)
      .digest('hex');

    if (metafyHash !== expectedHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid hash' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Resolve metafyId → FaB Bazaar userId
    const userResult = await userService.findByMetafyId(metafyId);
    if (!userResult.success || !userResult.data) {
      // Return 403 rather than 404 to avoid leaking user existence
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403, headers: CORS_HEADERS }
      );
    }
    const userId = userResult.data.id;

    // Validate request body
    const body = await request.json();
    const { sideboard } = body;

    if (
      !sideboard ||
      !Array.isArray(sideboard.in) ||
      !Array.isArray(sideboard.out)
    ) {
      return NextResponse.json(
        { success: false, error: 'sideboard with in/out arrays is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const resolvedParams = await params;

    // Fetch deck — no fallback; owner-only access
    const deckResult = await deckService.findByPublicId(resolvedParams.deckId, userId);

    if (!deckResult.success || !deckResult.data) {
      return NextResponse.json(
        { success: false, error: 'Deck not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const deck = deckResult.data;

    // Strict ownership check — owner only, not co-owners
    if (deck.userId?.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Upsert matchup — create if missing, update sideboard if existing
    const metadata = deck.metadata || {};
    const matchups: DeckMatchup[] = metadata.matchups || [];
    const existingIndex = matchups.findIndex(
      (m: DeckMatchup) => m.heroId === resolvedParams.heroId
    );

    const base: DeckMatchup = existingIndex >= 0
      ? matchups[existingIndex]
      : { heroId: resolvedParams.heroId, preferredTurnOrder: null, notes: null, sideboard: { in: [], out: [] } };

    const updated: DeckMatchup = {
      ...base,
      sideboard: { in: sideboard.in, out: sideboard.out },
    };

    // Strip stale card references then validate
    const sanitized = sanitizeMatchup(updated, deck);
    const validation = validateMatchup(sanitized, deck);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0], errors: validation.errors },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (existingIndex >= 0) {
      matchups[existingIndex] = sanitized;
    } else {
      matchups.push(sanitized);
    }
    metadata.matchups = matchups;

    const updateResult = await deckService.updateDeck(
      resolvedParams.deckId,
      userId,
      { metadata }
    );

    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, error: updateResult.error },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: { matchup: sanitized } },
      { headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[Matchup Patch] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * PUT /api/decks/[deckId]/matchups/[heroId]
 *
 * Update a specific matchup
 *
 * Authentication: Required (any method)
 *
 * Request Body:
 * {
 *   "matchup": {
 *     "heroId": "briar_warden_of_thorns",  // Must match URL heroId
 *     "preferredTurnOrder": "First" | "Second" | "NoPreference" | null,
 *     "notes": "Strategy notes",
 *     "sideboard": {
 *       "in": ["card_id_1"],
 *       "out": ["card_id_2"]
 *     }
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "matchup": {...} }
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { deckId: string; heroId: string } }
) {
  try {
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { matchup } = body;

    if (!matchup) {
      return NextResponse.json(
        { success: false, error: 'Matchup data required' },
        { status: 400 }
      );
    }

    // Fetch deck (fallback without userId for non-owner lookups)
    let deckResult = await deckService.findByPublicId(
      resolvedParams.deckId,
      authResult.userId
    );
    if (deckResult.success && !deckResult.data) {
      deckResult = await deckService.findByPublicId(resolvedParams.deckId);
    }

    if (!deckResult.success || !deckResult.data) {
      return NextResponse.json(
        { success: false, error: 'Deck not found' },
        { status: 404 }
      );
    }

    const deck = deckResult.data;

    // Validate ownership
    if (deck.userId?.toString() !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Ensure heroId matches
    if (matchup.heroId !== resolvedParams.heroId) {
      return NextResponse.json(
        { success: false, error: 'Hero ID mismatch' },
        { status: 400 }
      );
    }

    // Strip stale sideboard entries (cards removed from deck/inventory since last save)
    const sanitized = sanitizeMatchup(matchup, deck);

    // Validate matchup
    const validation = validateMatchup(sanitized, deck);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    // Update matchup in metadata
    const metadata = deck.metadata || {};
    const matchups = metadata.matchups || [];

    const existingIndex = matchups.findIndex(
      (m: DeckMatchup) => m.heroId === resolvedParams.heroId
    );

    if (existingIndex < 0) {
      return NextResponse.json(
        { success: false, error: 'Matchup not found' },
        { status: 404 }
      );
    }

    matchups[existingIndex] = sanitized;
    metadata.matchups = matchups;

    // Update deck
    const updateResult = await deckService.updateDeck(
      resolvedParams.deckId,
      authResult.userId,
      { metadata }
    );

    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, error: updateResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { matchup: sanitized }
    });

  } catch (error) {
    console.error('[Matchup Update] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/decks/[deckId]/matchups/[heroId]
 *
 * Delete a specific matchup
 *
 * Authentication: Required (any method)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "message": "Matchup deleted" }
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { deckId: string; heroId: string } }
) {
  try {
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const resolvedParams = await params;

    // Fetch deck (fallback without userId for non-owner lookups)
    let deckResult = await deckService.findByPublicId(
      resolvedParams.deckId,
      authResult.userId
    );
    if (deckResult.success && !deckResult.data) {
      deckResult = await deckService.findByPublicId(resolvedParams.deckId);
    }

    if (!deckResult.success || !deckResult.data) {
      return NextResponse.json(
        { success: false, error: 'Deck not found' },
        { status: 404 }
      );
    }

    const deck = deckResult.data;

    // Validate ownership
    if (deck.userId?.toString() !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Remove matchup from metadata
    const metadata = deck.metadata || {};
    const matchups = metadata.matchups || [];

    const filteredMatchups = matchups.filter(
      (m: DeckMatchup) => m.heroId !== resolvedParams.heroId
    );

    if (filteredMatchups.length === matchups.length) {
      return NextResponse.json(
        { success: false, error: 'Matchup not found' },
        { status: 404 }
      );
    }

    metadata.matchups = filteredMatchups;

    // Update deck
    const updateResult = await deckService.updateDeck(
      resolvedParams.deckId,
      authResult.userId,
      { metadata }
    );

    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, error: updateResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Matchup deleted' }
    });

  } catch (error) {
    console.error('[Matchup Delete] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
