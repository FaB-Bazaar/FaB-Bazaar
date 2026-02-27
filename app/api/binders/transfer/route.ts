// app/api/binders/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { binderService } from '@/lib/services';

/**
 * POST /api/binders/transfer
 *
 * Bulk transfer all cards from one binder to another
 * - Deletes all cards from source binder
 * - Adds all cards to target binder
 * - Merges quantities for duplicate printings
 * - Concatenates notes for duplicates
 *
 * Uses binderService.transferAllCards() for the operation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceBinderId, targetBinderId } = body;

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

    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Use service layer to transfer all cards
    const result = await binderService.transferAllCards(
      sourceBinderId,
      targetBinderId,
      userId
    );

    if (!result.success) {
      // Handle specific error cases
      const status = result.error?.includes('not found') ? 404 :
                    result.error?.includes('Access denied') ? 403 : 500;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    // Map service response to maintain API contract compatibility
    return NextResponse.json({
      success: true,
      message: result.data.message,
      summary: {
        totalTransferred: result.data.transferred + result.data.merged,
        newCards: result.data.transferred,
        mergedCards: result.data.merged,
        totalCardsDeleted: result.data.transferred + result.data.merged
      }
    });

  } catch (error) {
    console.error('[BulkTransfer] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to transfer cards'
    }, { status: 500 });
  }
}
