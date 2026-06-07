import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import { requireFacetManager } from '../_auth';

function parseBody(body: unknown): { cardUniqueId: string; tag: string } | null {
  const { cardUniqueId, tag } = (body ?? {}) as Record<string, unknown>;
  if (typeof cardUniqueId !== 'string' || !cardUniqueId || typeof tag !== 'string' || !tag) return null;
  return { cardUniqueId, tag };
}

// POST /api/admin/card-facets/assign — add one tag to a card (all same-name variants)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const parsed = parseBody(body);
  if (!parsed) return NextResponse.json({ error: 'cardUniqueId and tag are required' }, { status: 400 });

  const result = await facetService.addCardFacetTag(parsed.cardUniqueId, parsed.tag);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// DELETE /api/admin/card-facets/assign — remove one tag from a card (all same-name variants)
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const parsed = parseBody(body);
  if (!parsed) return NextResponse.json({ error: 'cardUniqueId and tag are required' }, { status: 400 });

  const result = await facetService.removeCardFacetTag(parsed.cardUniqueId, parsed.tag);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
