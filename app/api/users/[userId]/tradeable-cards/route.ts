// app/api/users/[userId]/tradeable-cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { inventoryService } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const sortBy = (searchParams.get('sortBy') || 'name') as 'name' | 'set' | 'price' | 'quantity';
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

    // Get tradeable cards using service. Pass the authenticated caller so the
    // owner sees all their own for-trade cards; non-owners get only the
    // public, trade-discoverable subset (enforced in the service layer).
    const result = await inventoryService.getTradeableCards(userId, {
      skip: (page - 1) * limit,
      limit,
      search: search || undefined,
      sortBy,
      sortOrder,
      requestingUserId: authResult.userId,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Transform cards to match expected format
    const transformedCards = result.data.items.map(card => ({
      // Card inventory data
      _id: card._id,
      id: card._id,
      binderName: card.binderName,
      binderId: card.binderId,
      quantity: card.quantity,
      condition: card.condition,
      forTrade: card.forTrade,

      // Printing data
      printingId: card.printingId,
      name: card.display_name,
      display_name: card.display_name,
      set: card.set,
      foiling: card.foiling,
      image_url: card.image_url,

      // Price data
      tcg_market: card.tcg_market,
    }));

    // Calculate summary stats
    const totalValue = transformedCards.reduce((sum, card) =>
      sum + ((card.tcg_market || 0) * card.quantity), 0
    );

    const summary = {
      totalCards: result.data.total,
      totalValue: parseFloat(totalValue.toFixed(2)),
      currentPage: result.data.page,
      totalPages: result.data.totalPages,
      hasNextPage: result.data.page < result.data.totalPages,
      hasPreviousPage: result.data.page > 1
    };

    return NextResponse.json({
      success: true,
      cards: transformedCards,
      summary,
      pagination: {
        page: result.data.page,
        limit: result.data.limit,
        total: result.data.total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tradeable cards:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tradeable cards',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}