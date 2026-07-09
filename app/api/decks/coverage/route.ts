// POST /api/decks/coverage — batch collection-coverage summaries for a list
// of deck publicIds ("which of these decks could I build from my collection?").
// Backs the compare_collection_to_decks_to_beat MCP tool; allowOAuth so
// Volzar/OAuth callers work (see Known Gotchas in CLAUDE.md).
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }

    const deckIds = body?.deckIds;
    if (!Array.isArray(deckIds) || deckIds.length === 0 || !deckIds.every((d: unknown) => typeof d === 'string')) {
      return NextResponse.json({ error: 'deckIds must be a non-empty array of deck public IDs' }, { status: 400 });
    }

    const topMissingLimit = Number(body?.topMissingLimit);
    const result = await deckService.getDecksCoverageSummary(deckIds, authResult.userId, {
      matchBy: 'card',
      ...(Number.isInteger(topMissingLimit) && topMissingLimit > 0 ? { topMissingLimit } : {}),
    });
    if (!result.success) {
      // Validation-shaped failures (empty list / too many) are caller errors.
      const status = /max \d+|non-empty/.test(result.error) ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[DecksCoverage] Error:', error);
    return NextResponse.json({ error: 'Failed to compute deck coverage' }, { status: 500 });
  }
}
