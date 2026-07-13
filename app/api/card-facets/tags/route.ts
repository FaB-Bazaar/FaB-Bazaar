import { NextResponse } from 'next/server';
import { facetService } from '@/lib/services';

// GET /api/card-facets/tags — PUBLIC read of the facet vocabulary (id, dim,
// label, def, draft, cardCount). Read-only; no auth. Powers the community
// card-facet page's filter rail and per-card editor.
export async function GET() {
  const result = await facetService.getTagUsageCounts();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
