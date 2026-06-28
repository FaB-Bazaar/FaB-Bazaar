import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { gameResultsService } from '@/lib/services';

// GET /api/results/recent — the caller's most recent games across ALL their own
// decks (newest first), each labeled with its deck. Lets a client list recent
// games without knowing the deck name, then drill into one via the per-deck
// results / raw endpoints. Owner-scoped (auth user only).
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 1), 50);

    const result = await gameResultsService.getRecentGameResultsForUser(authResult.userId as string, limit);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Results] recent error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
