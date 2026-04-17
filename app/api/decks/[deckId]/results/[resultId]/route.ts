import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService } from '@/lib/services';

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
