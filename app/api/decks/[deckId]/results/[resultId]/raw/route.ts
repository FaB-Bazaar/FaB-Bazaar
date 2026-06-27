import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, gameResultsService } from '@/lib/services';
import { analyzeGame, type RawGamePayload } from '@/lib/talishar/analyzeGame';

// Deep-dive handler for one game's archived blob. Owner/co-owner only (the blob
// carries turn-by-turn opponent data). Games without an archive return
// data: null so the web client simply omits the deep-dive panel.
//   default        → analyzed data (web deep-dive)
//   ?shape=raw     → the stored blob verbatim (used by the get_results MCP tool)
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

    const result = await gameResultsService.getRawGamePayload(resultId, deckLookup.data._id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    if (!result.data) {
      return NextResponse.json({ success: true, data: null });
    }

    const shape = new URL(request.url).searchParams.get('shape');
    const data = shape === 'raw' ? result.data : analyzeGame(result.data as unknown as RawGamePayload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Deck Results] Raw deep-dive error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
