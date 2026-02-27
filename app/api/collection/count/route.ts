import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';

/**
 * GET /api/collection/count
 *
 * Returns real-time card count by querying actual inventory items
 * This is more accurate than stats-based counts which rely on cached data
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Not authenticated" },
        { status: 401 }
      );
    }

    // Get all cards for user (this queries inventory directly)
    const cardsResult = await binderService.getAllCardsForUser(
      authResult.userId,
      {}, // no filters
      { limit: 10000 } // high limit to get all cards
    );

    if (!cardsResult.success) {
      return NextResponse.json(
        { success: false, error: cardsResult.error },
        { status: 500 }
      );
    }

    // Count total quantity (sum of all card quantities)
    const totalQuantity = cardsResult.data.cards.reduce((sum, card) => {
      return sum + (card.quantity || 1);
    }, 0);

    // Count unique printings
    const uniquePrintings = cardsResult.data.cards.length;

    return NextResponse.json({
      success: true,
      data: {
        totalQuantity,
        uniquePrintings,
      }
    });
  } catch (error) {
    console.error('Error counting cards:', error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
