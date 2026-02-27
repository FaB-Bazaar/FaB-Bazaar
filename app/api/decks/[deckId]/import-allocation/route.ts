// app/api/decks/[deckId]/import-allocation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

// POST /api/decks/[deckId]/import-allocation
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    console.log('[DeckImportAllocation] Request received for deck:', resolvedParams.deckId);

    // Authentication
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Validate payload structure - expecting simplified structure
    const { hero, equipment, maindeck, inventory, tokens, maybeboard, debug } = body;

    const allocationArrays: Record<string, Array<{ printingId: string; quantity?: number }> | undefined> = {
      hero, equipment, maindeck, inventory, tokens, maybeboard
    };
    const hasAnyArrays = Object.values(allocationArrays).some(arr => Array.isArray(arr) && arr.length > 0);

    if (!hasAnyArrays) {
      return NextResponse.json({
        success: false,
        error: 'At least one category array (hero, equipment, maindeck, inventory, tokens, maybeboard) with printingId/quantity objects is required'
      }, { status: 400 });
    }

    if (debug) {
      console.log('[DeckImportAllocation] Debug mode enabled');
      console.log('[DeckImportAllocation] Allocation summary:', {
        hero: hero?.length || 0,
        equipment: equipment?.length || 0,
        maindeck: maindeck?.length || 0,
        inventory: inventory?.length || 0,
        tokens: tokens?.length || 0,
        maybeboard: maybeboard?.length || 0
      });
    }

    // Build allocation object for service
    const allocation: Record<DeckCategory, Array<{ printingId: string; quantity?: number }>> = {
      hero: hero || [],
      equipment: equipment || [],
      maindeck: maindeck || [],
      inventory: inventory || [],
      tokens: tokens || [],
      maybeboard: maybeboard || [],
    };

    // Use service layer to import allocation
    const result = await deckService.importAllocation(
      resolvedParams.deckId,
      authResult.userId!,
      allocation
    );

    if (!result.success) {
      const status = result.error === 'Deck not found or access denied' ? 404 : 400;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    const deck = result.data;
    const totalCardsAdded = (hero?.length || 0) + (equipment?.length || 0) +
      (maindeck?.length || 0) + (inventory?.length || 0) +
      (tokens?.length || 0) + (maybeboard?.length || 0);

    console.log(`[DeckImportAllocation] Successfully added ${totalCardsAdded} cards to deck`);

    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      deck: {
        _id: deck._id?.toString(),
        name: deck.name,
        format: deck.format,
        totalCards: deck.totalCards,
        heroCount: deck.heroCount,
        equipmentCount: deck.equipmentCount,
        maindeckCount: deck.maindeckCount,
        inventoryCount: deck.inventoryCount,
        tokensCount: deck.tokensCount,
        maybeboardCount: deck.maybeboardCount,
        updatedAt: deck.updatedAt
      },
      summary: {
        totalCardsAdded,
        breakdown: {
          hero: hero?.length || 0,
          equipment: equipment?.length || 0,
          maindeck: maindeck?.length || 0,
          inventory: inventory?.length || 0,
          tokens: tokens?.length || 0,
          maybeboard: maybeboard?.length || 0
        }
      },
      message: `Added ${totalCardsAdded} cards to deck across ${Object.keys(allocationArrays).filter(k => allocationArrays[k]?.length).length} categories`
    });

  } catch (error) {
    console.error('[DeckImportAllocation] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to import allocation to deck' },
      { status: 500 }
    );
  }
}