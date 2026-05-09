// app/api/decks/[deckId]/printings/add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

// POST /api/decks/[deckId]/printings/add
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
    let printingsToAdd: Array<{
      printingId: string;
      quantity?: number;
      category?: string;
      condition?: string;
      notes?: string;
    }> = [];

    if (body.printings && Array.isArray(body.printings)) {
      // Batch format: { printings: [...] }
      printingsToAdd = body.printings;
    } else if (body.category && body.printingId) {
      // Single format: { category, printingId, condition, notes }
      printingsToAdd = [{
        printingId: body.printingId,
        quantity: body.quantity || 1,
        category: body.category,
        condition: body.condition || "NM",
        notes: body.notes || ""
      }];
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format. Expected either "printings" array or single printing with "category" and "printingId"',
        examples: {
          single: {
            category: "maindeck",
            printingId: "gLtfmmKdFNCrPptrpMmgz",
            quantity: 1,
            condition: "NM",
            notes: "Optional notes"
          },
          batch: {
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
        }
      }, { status: 400 });
    }

    if (printingsToAdd.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No printings to add'
      }, { status: 400 });
    }

    // Process each printing using the service layer
    const results: Array<{
      printingId: string;
      success: boolean;
      action?: string;
      cardName?: string;
      quantity?: number;
      category?: string;
      error?: string;
    }> = [];
    let totalCardsAdded = 0;

    for (const item of printingsToAdd) {
      if (!item.printingId) {
        results.push({
          printingId: item.printingId,
          success: false,
          error: 'Missing printingId'
        });
        continue;
      }

      // Use service layer to add printing
      const result = await deckService.addPrinting(
        resolvedParams.deckId,
        authResult.userId!,
        {
          printingId: item.printingId,
          quantity: item.quantity || 1,
          category: (item.category || 'maindeck') as DeckCategory,
          condition: item.condition || 'NM',
          notes: item.notes || '',
        }
      );

      if (result.success) {
        // The service returns AddPrintingResultDTO, which carries its own
        // per-card success/error (rejected by validation, not-found printing,
        // etc.). Surface that inner status so per-card validation failures
        // reach the client instead of being masked as success.
        if (result.data.success) {
          totalCardsAdded += result.data.quantity ?? 0;
          results.push({
            printingId: item.printingId,
            success: true,
            action: 'added',
            cardName: result.data.cardName,
            quantity: result.data.quantity,
            category: result.data.category,
          });
        } else {
          results.push({
            printingId: item.printingId,
            success: false,
            error: result.data.error,
          });
        }
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

    const summary = {
      total: results.length,
      added: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalCardsAdded
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
      message: `Added ${totalCardsAdded} cards to deck in ${results.length} operations`
    });

  } catch (error) {
    console.error('[DeckPrintings-Add] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add printings to deck' },
      { status: 500 }
    );
  }
}