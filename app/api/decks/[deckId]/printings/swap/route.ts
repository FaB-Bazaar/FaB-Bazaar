// app/api/decks/[deckId]/printings/swap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

// POST /api/decks/[deckId]/printings/swap
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
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

    // Validate required fields
    const { oldPrintingId, newPrintingId, category } = body;

    if (!oldPrintingId || !newPrintingId || !category) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: oldPrintingId, newPrintingId, category',
        example: {
          oldPrintingId: "ABC123",
          newPrintingId: "XYZ789",
          category: "maindeck",
          condition: "NM",
          notes: "Optional notes",
          preservePosition: true
        }
      }, { status: 400 });
    }

    // Copies to move (deck lightbox: 1, 2 or all N). Omitted = 1, the
    // historical behaviour; anything else must be a positive integer.
    const quantity = body.quantity === undefined ? 1 : body.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({
        success: false,
        error: 'quantity must be a positive integer',
      }, { status: 400 });
    }

    // Use service layer to swap printing
    const result = await deckService.swapPrinting(
      resolvedParams.deckId,
      authResult.userId!,
      oldPrintingId,
      newPrintingId,
      category as DeckCategory,
      quantity
    );

    if (!result.success) {
      const status = result.error === 'Deck not found or access denied' ? 404 : 400;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    const deck = result.data;

    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      deck: {
        _id: deck._id?.toString(),
        name: deck.name,
        totalCards: deck.totalCards,
        heroCount: deck.heroCount,
        equipmentCount: deck.equipmentCount,
        maindeckCount: deck.maindeckCount,
        inventoryCount: deck.inventoryCount,
        estimatedValue: deck.estimatedValue,
        updatedAt: deck.updatedAt
      },
      result: {
        action: 'swapped',
        category,
        oldPrintingId,
        newPrintingId
      },
      message: `Swapped printing in ${category}`
    });

  } catch (error) {
    console.error('[DeckPrintings-Swap] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to swap printing' },
      { status: 500 }
    );
  }
}