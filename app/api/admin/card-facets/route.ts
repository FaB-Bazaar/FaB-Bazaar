import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import { requireFacetManager } from './_auth';

// GET /api/admin/card-facets?cardUniqueId=... — current facet tags for a card
export async function GET(request: NextRequest) {
  const gate = await requireFacetManager(request);
  if (!gate.ok) return gate.response;

  const cardUniqueId = request.nextUrl.searchParams.get('cardUniqueId');
  if (!cardUniqueId) {
    return NextResponse.json({ error: 'cardUniqueId is required' }, { status: 400 });
  }

  const result = await printingsService.getCardFacetTags(cardUniqueId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// POST /api/admin/card-facets — set the facet tags for a card (replaces existing)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const { cardUniqueId, tags } = body as { cardUniqueId?: unknown; tags?: unknown };
  if (typeof cardUniqueId !== 'string' || !cardUniqueId) {
    return NextResponse.json({ error: 'cardUniqueId is required' }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
    return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 });
  }

  const result = await printingsService.setCardFacetTags(cardUniqueId, tags as string[]);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
