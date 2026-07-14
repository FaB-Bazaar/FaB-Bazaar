import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import { requireFacetManager } from '../_auth';

// GET /api/admin/card-facets/pending — the curator approval queue: pending public
// facet-vote requests, one row per (card name, tag, requester).
export async function GET(request: NextRequest) {
  const gate = await requireFacetManager(request);
  if (!gate.ok) return gate.response;

  const result = await facetService.listPendingFacetVotes();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
