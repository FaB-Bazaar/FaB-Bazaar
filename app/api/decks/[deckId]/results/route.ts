import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId } = await params;

    const deckLookup = await deckService.findByPublicId(publicId, authResult.userId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    const isCoOwner = (deckLookup.data.coOwners ?? []).includes(authResult.userId ?? '');
    if (deckLookup.data.userId?.toString() !== authResult.userId && !isCoOwner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const internalDeckId = deckLookup.data._id;
    const result = await gameResultsService.getGameResultsForDeck(internalDeckId, { limit, offset });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data.data, total: result.data.total });
  } catch (error) {
    console.error('[Deck Results] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
