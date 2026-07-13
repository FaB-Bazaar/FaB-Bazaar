import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { facetService } from '@/lib/services';

// Grid pages are ≤60 cards; anything bigger is a misuse, not a real page.
const MAX_IDS = 100;

// GET /api/card-facets/summary?cardUniqueIds=a,b,c — PUBLIC batch read of each
// card's facet tags (live + pending) with community vote counts. Powers the
// tile badges on the public card-facets page. Auth is OPTIONAL: a signed-in
// caller gets their own votes flagged `mine` (personal-truth display).
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('cardUniqueIds') ?? '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'cardUniqueIds is required' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `At most ${MAX_IDS} cardUniqueIds per request` }, { status: 400 });
  }

  const auth = await authenticateRequest(request, {}, { allowOAuth: true }).catch(() => null);
  const viewerId = auth?.success ? auth.userId : undefined;

  const result = await facetService.getFacetSummaryForCards(ids, viewerId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
