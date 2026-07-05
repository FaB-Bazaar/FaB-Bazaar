// app/api/decks/archetype/route.ts — Deterministic archetype consensus across
// featured "Decks to Beat" of one hero in a rolling window. Public (no auth):
// featured decks are public data. No AI.
import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';
import type { DeckFormat } from '@/lib/services/contracts/IDeckService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const heroName = url.searchParams.get('heroName');
    if (!heroName?.trim()) {
      return NextResponse.json({ success: false, error: 'heroName is required' }, { status: 400 });
    }
    const format = (url.searchParams.get('format') as DeckFormat | null) || undefined;

    // Rolling window: last N months (default 3, clamped 1–24). dateFrom only —
    // no upper bound so recent/future-dated events are included.
    const months = Math.min(Math.max(parseInt(url.searchParams.get('months') || '3', 10) || 3, 1), 24);
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const dateFrom = from.toISOString().slice(0, 10);

    const result = await deckService.getArchetypeConsensus({ heroName, format, dateFrom });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, data: { ...result.data, heroName, format: format ?? null, months } });
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('[ArchetypeConsensus] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
