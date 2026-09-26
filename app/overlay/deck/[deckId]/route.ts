import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';
import { buildDeckOverlayModel, isOverlayVisible } from '@/lib/overlay/deck-overlay';
import { parseOverlayOptions, renderDeckOverlayHtml } from '@/lib/overlay/render-deck-overlay';

// GET /overlay/deck/[deckId] — chrome-less HTML deck overlay for OBS browser sources.
// A route handler (not a page) so the root layout's navbar/footer never render.
// OBS fetches with no session: only link-viewable decks are served (see isOverlayVisible).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params;
  const result = await deckService.findByPublicId(deckId);
  const deck = result.success ? result.data : null;

  if (!deck || !isOverlayVisible(deck)) {
    return new NextResponse('Deck not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }

  const html = renderDeckOverlayHtml(
    buildDeckOverlayModel(deck),
    parseOverlayOptions(request.nextUrl.searchParams)
  );

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
      'x-robots-tag': 'noindex',
    },
  });
}
