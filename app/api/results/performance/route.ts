// GET /api/results/performance — per-deck W/L, win-rate, form, and matchup
// aggregates across the caller's decks ("how are my decks performing?").
// Backs the get_deck_performance MCP tool; allowOAuth so Volzar/OAuth callers
// work (see Known Gotchas in CLAUDE.md).
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { gameResultsService } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }

    const sinceDaysRaw = Number(request.nextUrl.searchParams.get('sinceDays'));
    const sinceDays = Number.isFinite(sinceDaysRaw) && sinceDaysRaw > 0 ? Math.floor(sinceDaysRaw) : undefined;

    const result = await gameResultsService.getDeckPerformanceForUser(authResult.userId, {
      ...(sinceDays ? { sinceDays } : {}),
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[ResultsPerformance] Error:', error);
    return NextResponse.json({ error: 'Failed to compute deck performance' }, { status: 500 });
  }
}
