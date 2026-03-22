// app/api/decks/create-with-cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckFormat } from '@/lib/services/contracts/IDeckService';

// POST /api/decks/create-with-cards
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[CreateDeckWithCards] Request received');
    console.log('[CreateDeckWithCards] Payload keys:', Object.keys(body));

    // Authentication
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Validate payload
    const { name, format, isPublic, visibility, cards, debug } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Deck name is required'
      }, { status: 400 });
    }

    if (!format || typeof format !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Deck format is required'
      }, { status: 400 });
    }

    if (!Array.isArray(cards)) {
      return NextResponse.json({
        success: false,
        error: 'Cards array is required'
      }, { status: 400 });
    }

    if (debug) {
      console.log('[CreateDeckWithCards] Debug mode enabled');
      console.log('[CreateDeckWithCards] Creating deck:', { name, format, cardsCount: cards.length });
    }

    // Transform cards to AddPrintingDTO format
    const printings = cards.map((card: { printingId: string; quantity: number }) => ({
      printingId: card.printingId,
      quantity: card.quantity || 1,
      category: 'maindeck' as const, // Service will auto-allocate based on card type
      condition: 'NM' as const,
    }));

    // Use service layer to create deck with cards
    const result = await deckService.createDeckWithCards(
      authResult.userId!,
      {
        name: name.trim(),
        format: format as DeckFormat,
        visibility: visibility || (isPublic ? 'public' : undefined),
      },
      printings
    );

    if (!result.success) {
      console.error('[CreateDeckWithCards] Error:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    const deck = result.data;
    console.log(`[CreateDeckWithCards] Created deck '${deck.name}' with ID: ${deck._id}`);

    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      deck: {
        _id: deck._id?.toString(),
        publicId: deck.publicId,
        name: deck.name,
        format: deck.format,
        visibility: deck.visibility,
        isPublic: deck.isPublic,
        totalCards: deck.totalCards,
        heroCount: deck.heroCount,
        equipmentCount: deck.equipmentCount,
        maindeckCount: deck.maindeckCount,
        inventoryCount: deck.inventoryCount,
        tokensCount: deck.tokensCount,
        maybeboardCount: deck.maybeboardCount,
        estimatedValue: deck.estimatedValue,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt
      },
      allocation: {
        hero: deck.heroCount || 0,
        equipment: deck.equipmentCount || 0,
        maindeck: deck.maindeckCount || 0,
        inventory: deck.inventoryCount || 0,
        tokens: deck.tokensCount || 0,
        maybeboard: deck.maybeboardCount || 0
      },
      message: `Created deck '${deck.name}' with ${deck.totalCards} cards`
    });

  } catch (error) {
    console.error('[CreateDeckWithCards] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create deck with cards' },
      { status: 500 }
    );
  }
}