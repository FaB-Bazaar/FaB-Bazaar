// app/api/decks/[deckId]/printings/remove/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import { normalizeDeckCategory, DECK_CATEGORIES } from '@/lib/deck/deck-category';
import { sanitizeAllMatchups } from '@/lib/validation/matchup-validation';

// POST /api/decks/[deckId]/printings/remove
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    // Authentication
    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Handle both new format (with category) and array format (for batch operations)
    let printingsToRemove: Array<{
      printingId: string;
      quantity?: number;
      category?: string;
    }> = [];

    if (body.printings && Array.isArray(body.printings)) {
      // Batch format: { printings: [...] }
      printingsToRemove = body.printings;
    } else if (body.category && body.printingId) {
      // Single format: { category, printingId, quantity }
      printingsToRemove = [{
        printingId: body.printingId,
        quantity: body.quantity || 1,
        category: body.category
      }];
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format. Expected either "printings" array or single printing with "category" and "printingId"',
        examples: {
          single: {
            category: "maindeck",
            printingId: "gLtfmmKdFNCrPptrpMmgz",
            quantity: 1
          },
          batch: {
            printings: [
              {
                printingId: "gLtfmmKdFNCrPptrpMmgz",
                quantity: 1,
                category: "maindeck"
              }
            ]
          }
        }
      }, { status: 400 });
    }

    if (printingsToRemove.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No printings to remove'
      }, { status: 400 });
    }

    // Process each printing using service layer
    const results: Array<{
      printingId: string;
      success: boolean;
      action?: string;
      cardName?: string;
      quantity?: number;
      category?: string;
      error?: string;
    }> = [];
    let totalCardsRemoved = 0;

    for (const item of printingsToRemove) {
      if (!item.printingId) {
        results.push({
          printingId: item.printingId,
          success: false,
          error: 'Missing printingId'
        });
        continue;
      }

      // Normalize the zone name ("sideboard" → "inventory", etc.) so an
      // unknown value is a per-item error instead of matching nothing.
      const category = normalizeDeckCategory(item.category ?? 'maindeck');
      if (!category) {
        results.push({
          printingId: item.printingId,
          success: false,
          error: `Invalid category "${item.category}". Valid: ${DECK_CATEGORIES.join(', ')} ("sideboard" is accepted as an alias of "inventory")`,
        });
        continue;
      }

      // Use service layer to remove printing
      const result = await deckService.removePrinting(
        resolvedParams.deckId,
        authResult.userId!,
        item.printingId,
        category,
        item.quantity || 1
      );

      if (result.success) {
        totalCardsRemoved += item.quantity || 1;
        results.push({
          printingId: item.printingId,
          success: true,
          action: 'removed',
          quantity: item.quantity || 1,
          category,
        });
      } else {
        results.push({
          printingId: item.printingId,
          success: false,
          error: result.error,
        });
      }
    }

    // Get updated deck info
    const deckResult = await deckService.findByPublicId(resolvedParams.deckId, authResult.userId);

    // Sync matchup sideboards — strip any entries referencing cards now removed/reduced
    if (deckResult.success && deckResult.data) {
      const deck = deckResult.data;
      const matchups = deck.metadata?.matchups;
      if (Array.isArray(matchups) && matchups.length > 0) {
        const { matchups: sanitized, changed } = sanitizeAllMatchups(matchups, deck);
        if (changed) {
          await deckService.updateDeck(
            resolvedParams.deckId,
            authResult.userId!,
            { metadata: { ...deck.metadata, matchups: sanitized } }
          );
        }
      }
    }

    const summary = {
      total: results.length,
      removed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalCardsRemoved
    };

    return NextResponse.json({
      success: summary.failed === 0,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      summary,
      deck: deckResult.success ? {
        _id: deckResult.data._id?.toString(),
        name: deckResult.data.name,
        totalCards: deckResult.data.totalCards,
        heroCount: deckResult.data.heroCount,
        equipmentCount: deckResult.data.equipmentCount,
        maindeckCount: deckResult.data.maindeckCount,
        inventoryCount: deckResult.data.inventoryCount,
        estimatedValue: deckResult.data.estimatedValue,
        updatedAt: deckResult.data.updatedAt
      } : undefined,
      results,
      message: `Removed ${totalCardsRemoved} cards from deck in ${results.length} operations`
    });

  } catch (error) {
    console.error('[DeckPrintings-Remove] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove printings from deck' },
      { status: 500 }
    );
  }
}