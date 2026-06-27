import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService } from '@/lib/services';

// Detail handler for one game result. Used by the Results tab to lazy-load
// the turn-log fields (which the list endpoint omits for payload size).
// Access mirrors the list endpoint: owner or co-owner.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string; resultId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId, resultId } = await params;

    const deckLookup = await deckService.findByPublicId(publicId, authResult.userId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    const isCoOwner = (deckLookup.data.coOwners ?? []).includes(authResult.userId ?? '');
    if (deckLookup.data.userId?.toString() !== authResult.userId && !isCoOwner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const result = await gameResultsService.getGameResult(resultId, deckLookup.data._id);
    if (!result.success) {
      const status = result.error === 'Game result not found' ? 404 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Deck Results] Detail error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string; resultId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { deckId: publicId, resultId } = await params;

    const deckLookup = await deckService.findByPublicId(publicId, authResult.userId);
    if (!deckLookup.success || !deckLookup.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    if (deckLookup.data.userId?.toString() !== authResult.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const result = await gameResultsService.deleteGameResult(resultId, deckLookup.data._id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.error === 'Game result not found' ? 404 : 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Deck Results] Delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
