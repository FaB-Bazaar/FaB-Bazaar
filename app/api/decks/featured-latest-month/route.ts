// app/api/decks/featured-latest-month/route.ts
// Most recent month that actually has featured public decks, so the Decks to
// Beat page can fall back to a month with content when the current calendar
// month is empty in every format. Public (no auth); optional ?format= to scope by format.
import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';
import type { DeckFormat } from '@/lib/services/contracts/IDeckService';

export async function GET(request: NextRequest) {
  try {
    const format = new URL(request.url).searchParams.get('format') as DeckFormat | null;

    const result = await deckService.getLatestFeaturedMonth(format ?? undefined);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, data: result.data });
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error('[FeaturedLatestMonth] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
