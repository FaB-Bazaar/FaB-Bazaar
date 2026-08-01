// app/api/cards/[cardUniqueId]/deck-usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

/**
 * GET /api/cards/[cardUniqueId]/deck-usage
 *
 * The requesting user's own (non-system) decks that contain any printing of
 * the card, with per-deck quantity. Lazy-fetched by the binder tile
 * "Decks (N)" button — always scoped to the caller, never another user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardUniqueId: string }> }
) {
  try {
    const { cardUniqueId } = await params;

    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }

    const result = await deckService.getCardDeckUsage(authResult.userId!, cardUniqueId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error fetching card deck usage:', error);
    return NextResponse.json({ error: 'Failed to fetch deck usage' }, { status: 500 });
  }
}
