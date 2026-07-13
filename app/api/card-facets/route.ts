import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { facetService } from '@/lib/services';

// GET /api/card-facets?cardUniqueId=... — a card's community-voted tags with
// per-tag counts. Auth is OPTIONAL: the public facet page is browseable
// signed-out, so anonymous readers get votedByMe=false throughout; a signed-in
// caller gets their own votes highlighted. Writes stay gated (assign/suggest).
export async function GET(request: NextRequest) {
  const cardUniqueId = request.nextUrl.searchParams.get('cardUniqueId');
  if (!cardUniqueId) {
    return NextResponse.json({ error: 'cardUniqueId is required' }, { status: 400 });
  }

  const auth = await authenticateRequest(request, {}, { allowOAuth: true }).catch(() => null);
  const userId = auth?.success ? auth.userId : undefined;

  const result = await facetService.getCardCommunityTags(cardUniqueId, userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
