// app/api/decks/[deckId]/bulk-import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import { isQuantityAllowed, getMaxQuantityForCard } from '@/lib/bulk-import-limits';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

interface BulkImportCard {
  printingId: string;
  quantity: number;
  category: 'hero' | 'equipment' | 'maindeck' | 'inventory';
  cardName: string;
}

/**
 * Bulk import multiple cards to a deck with automatic categorization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    console.log('[DeckBulkImport] Request received for deck:', resolvedParams.deckId);

    // Authentication
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Validate payload
    const { cards } = body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cards array is required and must not be empty'
      }, { status: 400 });
    }

    // Validate each card in the array
    for (const [index, card] of cards.entries()) {
      if (!card.printingId || !card.category || typeof card.quantity !== 'number') {
        return NextResponse.json({
          success: false,
          error: `Card ${index + 1} (${card.cardName || 'unknown'}): Each card must have printingId, category, and quantity (number)`
        }, { status: 400 });
      }

      if (!['hero', 'equipment', 'maindeck', 'inventory'].includes(card.category)) {
        return NextResponse.json({
          success: false,
          error: `Card ${index + 1} (${card.cardName || 'unknown'}): Invalid category. Must be hero, equipment, maindeck, or inventory`
        }, { status: 400 });
      }

      if (!isQuantityAllowed(card.cardName || '', card.quantity)) {
        const maxAllowed = getMaxQuantityForCard(card.cardName || '');
        const limitText = maxAllowed === Infinity ? 'unlimited' : maxAllowed.toString();

        return NextResponse.json({
          success: false,
          error: `Card ${index + 1} (${card.cardName || 'unknown'}): Quantity must be between 1 and ${limitText} (received: ${card.quantity})`
        }, { status: 400 });
      }
    }

    // Transform cards to AddPrintingDTO format
    const printings = cards.map((card: BulkImportCard) => ({
      printingId: card.printingId,
      quantity: card.quantity,
      category: card.category as DeckCategory,
      condition: 'NM' as const,
    }));

    // Use service layer for bulk import
    const result = await deckService.bulkImport(
      resolvedParams.deckId,
      authResult.userId!,
      printings
    );

    if (!result.success) {
      const status = result.error === 'Deck not found or access denied' ? 404 : 400;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    console.log(`[DeckBulkImport] Successfully added ${result.data.totalAdded} cards to deck`);

    // Get updated deck info
    const deckResult = await deckService.findByPublicId(resolvedParams.deckId, authResult.userId);

    return NextResponse.json({
      success: true,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      deck: deckResult.success ? {
        _id: deckResult.data._id?.toString(),
        name: deckResult.data.name,
        format: deckResult.data.format,
        totalCards: deckResult.data.totalCards,
        heroCount: deckResult.data.heroCount,
        equipmentCount: deckResult.data.equipmentCount,
        maindeckCount: deckResult.data.maindeckCount,
        inventoryCount: deckResult.data.inventoryCount,
        updatedAt: deckResult.data.updatedAt
      } : undefined,
      summary: {
        totalCardsAdded: result.data.totalAdded,
        addedByCategory: result.data.addedByCategory,
        failures: result.data.failures.length > 0 ? result.data.failures : undefined,
        totalCardsRequested: cards.reduce((sum: number, c: BulkImportCard) => sum + c.quantity, 0)
      },
      message: result.data.failures.length > 0
        ? `Added ${result.data.totalAdded} cards with ${result.data.failures.length} failures`
        : `Successfully added ${result.data.totalAdded} cards to deck`
    });

  } catch (error) {
    console.error('[DeckBulkImport] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk import cards to deck' },
      { status: 500 }
    );
  }
}