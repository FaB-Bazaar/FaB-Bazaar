import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';
import type { DeckDTO } from '@/lib/services/contracts/IDeckService';
import { buildDeckOverlayModel, isOverlayVisible } from '@/lib/overlay/deck-overlay';
import {
  parseOverlayOptions,
  renderDeckOverlayHtml,
  renderNoDeckOverlayHtml,
} from '@/lib/overlay/render-deck-overlay';

// GET /overlay/u/[username]/deck — the user's chosen "streaming deck" as a chrome-less
// HTML overlay (see /overlay/deck/[deckId] for the per-deck version). One stable URL for
// the OBS browser source: the page polls ?check=1 and reloads when the user switches
// decks or edits the current one. No deck (or one that isn't link-viewable) renders an
// idle placeholder rather than a 404 so OBS keeps polling.
const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=15',
  'x-robots-tag': 'noindex',
};

function deckVersion(deck: DeckDTO | null): string {
  if (!deck || !isOverlayVisible(deck)) return '';
  const updated = deck.updatedAt ? new Date(deck.updatedAt).toISOString() : '';
  return `${deck.publicId}:${updated}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const result = await deckService.findStreamingDeckByUsername(username);
  const deck = result.success ? result.data : null;
  const version = deckVersion(deck);

  if (request.nextUrl.searchParams.get('check') === '1') {
    return NextResponse.json({ version }, { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }

  const poll = { url: `/overlay/u/${encodeURIComponent(username)}/deck?check=1`, version };
  const html = deck && version
    ? renderDeckOverlayHtml(buildDeckOverlayModel(deck), { ...parseOverlayOptions(request.nextUrl.searchParams), poll })
    : renderNoDeckOverlayHtml(poll);

  return new NextResponse(html, { headers: HTML_HEADERS });
}
