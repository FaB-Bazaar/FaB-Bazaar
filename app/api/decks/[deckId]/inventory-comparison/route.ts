// app/api/decks/[deckId]/inventory-comparison/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const resolvedParams = await params;
    const { searchParams } = new URL(request.url);
    const binderMode = searchParams.get('binderMode') || 'all';
    const binderId = searchParams.get('binderId');

    // Authentication
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    // Use service layer for inventory comparison
    const result = await deckService.getInventoryComparison(
      resolvedParams.deckId,
      authResult.userId!,
      {
        binderMode: binderMode as 'all' | 'specific',
        binderId: binderId || undefined
      }
    );

    if (!result.success) {
      const status = result.error === 'Deck not found or access denied' ? 404 : 500;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    // Get deck info - use findBySlugOrId to handle both publicId and ObjectId formats
    const deckResult = await deckService.findBySlugOrId(resolvedParams.deckId, authResult.userId);

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('[InventoryComparison] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compare deck with inventory' },
      { status: 500 }
    );
  }
}