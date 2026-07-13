import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import type { ApproveSuggestionOverrides, SuggestionStatus } from '@/lib/services/contracts/IFacetService';
import { requireFacetManager } from '../_auth';

// GET /api/admin/card-facets/suggestions?status=pending — review queue.
export async function GET(request: NextRequest) {
  const gate = await requireFacetManager(request);
  if (!gate.ok) return gate.response;

  const status = (request.nextUrl.searchParams.get('status') ?? 'pending') as SuggestionStatus;
  const result = await facetService.listSuggestions(status);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// PATCH /api/admin/card-facets/suggestions — { id, action: 'approve'|'reject', overrides? }
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const { id, action, overrides } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const result =
    action === 'approve'
      ? await facetService.approveSuggestion(id, gate.userId, overrides as ApproveSuggestionOverrides | undefined)
      : await facetService.rejectSuggestion(id, gate.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
