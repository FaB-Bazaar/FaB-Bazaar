// app/api/decks/[deckId]/printings/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

// POST /api/decks/[deckId]/printings/update
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    // Authentication
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Extract printings array - ALWAYS expect an array
    const { printings } = body;

    // Validate input
    if (!printings || !Array.isArray(printings) || printings.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'printings array is required and must contain at least one item',
        example: {
          printings: [
            {
              printingId: "gLtfmmKdFNCrPptrpMmgz",
              updates: {
                category: "sideboard",
                condition: "LP",
                notes: "Updated notes"
              }
            }
          ]
        }
      }, { status: 400 });
    }

    // Call deckService to update printings
    const result = await deckService.updatePrintings(
      resolvedParams.deckId,
      authResult.userId!,
      printings
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const { summary, results, deck } = result.data;

    return NextResponse.json({
      success: summary.failed === 0,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      summary,
      deck,
      results,
      message: `Updated ${summary.totalCardsUpdated} cards in deck across ${results.length} operations`
    });

  } catch (error) {
    console.error('[DeckPrintings-Update] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update printings in deck' },
      { status: 500 }
    );
  }
}