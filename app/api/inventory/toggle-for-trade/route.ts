// app/api/inventory/toggle-for-trade/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { binderService } from '@/lib/services';

/**
 * POST /api/inventory/toggle-for-trade
 *
 * Update forTrade status for inventory items by printingId(s) for the current user
 * Supports both single and bulk operations
 *
 * Body:
 * - Single: { printingId: "abc123", forTrade: true }
 * - Bulk: { printingIds: ["abc", "def", "xyz"], forTrade: true }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { printingId, printingIds, forTrade } = body;

    // Validate input
    if (typeof forTrade !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'forTrade (boolean) is required'
      }, { status: 400 });
    }

    // Support both single and bulk operations
    let printingIdsArray: string[] = [];
    if (printingId) {
      printingIdsArray = [printingId];
    } else if (Array.isArray(printingIds) && printingIds.length > 0) {
      printingIdsArray = printingIds;
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either printingId or printingIds array is required'
      }, { status: 400 });
    }

    // Use service layer for the update
    const result = await binderService.toggleForTradeByPrintingIds(
      session.user.id,
      printingIdsArray,
      forTrade
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to update forTrade status'
      }, { status: 500 });
    }

    console.log(`[ToggleForTrade] Updated ${result.data.modifiedCount} items for user ${session.user.id}, printingIds: ${printingIdsArray.length}, forTrade: ${forTrade}`);

    return NextResponse.json({
      success: true,
      updatedCount: result.data.modifiedCount,
      printingIdsProcessed: result.data.printingIdsProcessed,
      message: `Updated ${result.data.modifiedCount} inventory ${result.data.modifiedCount === 1 ? 'item' : 'items'}`
    });

  } catch (error) {
    console.error('[ToggleForTrade] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update forTrade status' },
      { status: 500 }
    );
  }
}
