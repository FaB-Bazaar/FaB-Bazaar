// app/api/decks/ownership-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Authentication
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Validate input
    const { printingIds } = body;
    if (!printingIds || !Array.isArray(printingIds)) {
      return NextResponse.json({
        success: false,
        error: 'printingIds array is required'
      }, { status: 400 });
    }

    if (printingIds.length === 0) {
      return NextResponse.json({
        success: true,
        ownership: {}
      });
    }

    if (printingIds.length > 100) {
      return NextResponse.json({
        success: false,
        error: 'Maximum 100 printing IDs allowed per request'
      }, { status: 400 });
    }

    // Use service layer to get ownership status
    const result = await deckService.getOwnershipStatus(authResult.userId!, printingIds);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Transform to map format for backwards compatibility
    const ownershipMap: { [printingId: string]: any } = {};
    result.data.forEach(status => {
      ownershipMap[status.printingId] = status;
    });

    // Calculate summary statistics
    const totalCardsOwned = result.data.reduce((sum, status) => sum + status.owned, 0);
    const cardsForTrade = result.data.filter(status => status.forTrade).length;
    const totalValue = result.data.reduce((sum, status) => sum + ((status.estimatedValue || 0) * status.owned), 0);

    return NextResponse.json({
      success: true,
      ownership: ownershipMap,
      summary: {
        totalCardsRequested: printingIds.length,
        totalCardsOwned,
        cardsForTrade,
        totalValue: Math.round(totalValue * 100) / 100,
        ownedPercentage: Math.round((result.data.filter(s => s.owned > 0).length / printingIds.length) * 100)
      },
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username
    });

  } catch (error) {
    console.error('[OwnershipStatus] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ownership status' },
      { status: 500 }
    );
  }
}

// GET method for simple single printing queries via URL params
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const printingIds = searchParams.get('printingIds');

    if (!printingIds) {
      return NextResponse.json({
        success: false,
        error: 'printingIds parameter is required'
      }, { status: 400 });
    }

    // Convert to POST body format and call POST method
    const body = {
      printingIds: printingIds.split(',').map(id => id.trim()).filter(Boolean)
    };

    // Create a new request with the body for POST method
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(body)
    });

    return await POST(postRequest);

  } catch (error) {
    console.error('[OwnershipStatus] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ownership status' },
      { status: 500 }
    );
  }
}