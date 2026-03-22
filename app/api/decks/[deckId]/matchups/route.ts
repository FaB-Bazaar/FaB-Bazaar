// app/api/decks/[deckId]/matchups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import { validateMatchup } from '@/lib/validation/matchup-validation';
import { DeckMatchup } from '@/types/deck';

/**
 * POST /api/decks/[deckId]/matchups
 *
 * Create a new matchup for a deck
 *
 * Authentication: Required (any method)
 *
 * Request Body:
 * {
 *   "matchup": {
 *     "heroId": "briar_warden_of_thorns",
 *     "preferredTurnOrder": "First" | "Second" | "NoPreference" | null,
 *     "notes": "Strategy notes (max 500 chars)",
 *     "sideboard": {
 *       "in": ["card_id_1", "card_id_2"],
 *       "out": ["card_id_3", "card_id_4"]
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
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const authResult = await authenticateRequest(request, {});
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

    // Validate matchup
    const validation = validateMatchup(matchup, deck);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    // Add matchup to metadata
    const metadata = deck.metadata || {};
    const matchups = metadata.matchups || [];

    // Check for duplicate heroId
    const existingIndex = matchups.findIndex(
      (m: DeckMatchup) => m.heroId === matchup.heroId
    );

    if (existingIndex >= 0) {
      return NextResponse.json(
        { success: false, error: `Matchup for ${matchup.heroId} already exists` },
        { status: 400 }
      );
    }

    matchups.push(matchup);
    metadata.matchups = matchups;

    // Update deck via service
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
      data: { matchup }
    });

  } catch (error) {
    console.error('[Matchup Create] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/decks/[deckId]/matchups
 *
 * List all matchups for a deck
 *
 * Authentication: Required (any method)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "matchups": [...]
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const resolvedParams = await params;
    const authResult = await authenticateRequest(request, {});

    // Fetch deck — try with userId first, then without for public/unlisted access
    let deckResult = authResult.success
      ? await deckService.findByPublicId(resolvedParams.deckId, authResult.userId)
      : { success: true as const, data: null };

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

    // Private decks: only the owner can see matchups
    if (deck.visibility === 'private' && (!authResult.success || deck.userId?.toString() !== authResult.userId)) {
      return NextResponse.json(
        { success: false, error: 'Deck not found' },
        { status: 404 }
      );
    }

    const matchups = deck.metadata?.matchups || [];

    return NextResponse.json({
      success: true,
      data: { matchups }
    });

  } catch (error) {
    console.error('[Matchup List] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
