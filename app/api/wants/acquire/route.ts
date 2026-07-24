/**
 * Wants Acquire API Route - POST
 *
 * Mark wants-list cards as acquired: adds them to one of the user's binders
 * and reduces/removes the corresponding wants items in a single transaction.
 * Uses wantsService.acquireWantsToBinder() for the operation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { wantsService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetBinderId, cards } = body;

    if (!targetBinderId) {
      return NextResponse.json(
        { success: false, error: 'Missing targetBinderId' },
        { status: 400 }
      );
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or empty cards array' },
        { status: 400 }
      );
    }

    for (const card of cards) {
      if (!card.printingId || typeof card.quantity !== 'number' || card.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: 'Each card must have a valid printingId and quantity > 0' },
          { status: 400 }
        );
      }
    }

    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const cardsToAcquire = cards.map((c: { printingId: string; quantity: number }) => ({
      printingId: c.printingId,
      quantity: c.quantity,
    }));

    const result = await wantsService.acquireWantsToBinder(
      authResult.userId,
      targetBinderId,
      cardsToAcquire
    );

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 :
                    result.error?.includes('access denied') ? 403 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      message: result.data.message,
      summary: result.data.summary,
      results: result.data.results,
    });
  } catch (error) {
    console.error('[WantsAcquire] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to acquire cards' },
      { status: 500 }
    );
  }
}
