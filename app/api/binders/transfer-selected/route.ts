// app/api/binders/transfer-selected/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';

/**
 * POST /api/binders/transfer-selected
 *
 * Selective bulk transfer of specific cards from one binder to another
 * - Supports partial quantity transfers (e.g., transfer 2 of 5 cards)
 * - Handles full quantity transfers (deletes from source)
 * - Merges quantities for duplicate printings in target
 *
 * Uses binderService.transferSelectedCards() for the operation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceBinderId, targetBinderId, cards } = body;

    // Validate request
    if (!sourceBinderId || !targetBinderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing sourceBinderId or targetBinderId'
      }, { status: 400 });
    }

    if (sourceBinderId === targetBinderId) {
      return NextResponse.json({
        success: false,
        error: 'Source and target binders cannot be the same'
      }, { status: 400 });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Missing or empty cards array'
      }, { status: 400 });
    }

    // Validate card structure
    for (const card of cards) {
      if (!card.cardId || typeof card.quantity !== 'number' || card.quantity <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Each card must have a valid cardId and quantity > 0'
        }, { status: 400 });
      }
    }

    // Authenticate
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const userId = authResult.userId;

    // Convert to service layer format
    const cardsToTransfer = cards.map((c: { cardId: string; quantity: number }) => ({
      cardId: c.cardId,
      quantity: c.quantity
    }));

    // Use service layer to transfer selected cards
    const result = await binderService.transferSelectedCards(
      sourceBinderId,
      targetBinderId,
      userId,
      cardsToTransfer
    );

    if (!result.success) {
      // Handle specific error cases
      const status = result.error?.includes('not found') ? 404 :
                    result.error?.includes('Access denied') ? 403 :
                    result.error?.includes('exceeds') ? 400 : 500;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    // Return service response directly (already matches API contract)
    return NextResponse.json({
      success: true,
      message: result.data.message,
      summary: result.data.summary,
      results: result.data.results
    });

  } catch (error) {
    console.error('[TransferSelected] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to transfer cards'
    }, { status: 500 });
  }
}
