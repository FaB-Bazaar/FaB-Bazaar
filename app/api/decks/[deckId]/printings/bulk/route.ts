// app/api/decks/[deckId]/printings/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

// POST /api/decks/[deckId]/printings/bulk
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    // 1. Authenticate (supports multi-auth: session, Discord bot, MCP, OAuth)
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // 2. Validate request format
    const { printings } = body;

    if (!printings || !Array.isArray(printings)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format. Expected "printings" array',
        example: {
          printings: [
            {
              printingId: "gLtfmmKdFNCrPptrpMmgz",
              quantity: 1,
              category: "maindeck",
              condition: "NM",
              notes: "Optional notes"
            }
          ]
        }
      }, { status: 400 });
    }

    if (printings.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No printings to add'
      }, { status: 400 });
    }

    // 3. Call optimized bulk service method
    // This pre-fetches all printings in one query (more efficient than looping)
    const result = await deckService.addPrintings(
      resolvedParams.deckId,
      authResult.userId!,
      printings
    );

    // 4. Handle service result
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // 5. Return success response with detailed summary
    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      data: result.data,  // Contains summary, results, and deck
      message: `Added ${result.data.summary.totalCardsAdded} cards to deck in ${result.data.summary.added} operations`
    });

  } catch (error) {
    console.error('[DeckPrintings-Bulk] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add printings to deck' },
      { status: 500 }
    );
  }
}
