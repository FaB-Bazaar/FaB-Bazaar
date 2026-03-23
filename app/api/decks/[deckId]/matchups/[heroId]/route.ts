// app/api/decks/[deckId]/matchups/[heroId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import { validateMatchup } from '@/lib/validation/matchup-validation';
import { DeckMatchup } from '@/types/deck';

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

    // Validate matchup
    const validation = validateMatchup(matchup, deck);
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

    matchups[existingIndex] = matchup;
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
      data: { matchup }
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
