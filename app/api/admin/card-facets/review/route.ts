import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import { requireFacetManager } from '../_auth';

// POST /api/admin/card-facets/review — approve or reject a pending public
// facet-vote request. Body: { cardUniqueId, tag, userId, action: 'approve'|'reject' }.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const { cardUniqueId, tag, userId, action } = (body ?? {}) as Record<string, unknown>;
  if (typeof cardUniqueId !== 'string' || !cardUniqueId || typeof tag !== 'string' || !tag || typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'cardUniqueId, tag and userId are required' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  const result =
    action === 'approve'
      ? await facetService.approveFacetVote(cardUniqueId, tag, userId, gate.userId)
      : await facetService.rejectFacetVote(cardUniqueId, tag, userId, gate.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
