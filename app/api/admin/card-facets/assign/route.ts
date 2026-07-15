import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import type { FacetAssignScope } from '@/lib/services/contracts/IFacetService';
import { requireFacetManager } from '../_auth';

const SCOPES: readonly FacetAssignScope[] = ['name', 'card'];

function parseBody(body: unknown): { cardUniqueId: string; tag: string; scope?: FacetAssignScope } | null {
  const { cardUniqueId, tag, scope } = (body ?? {}) as Record<string, unknown>;
  if (typeof cardUniqueId !== 'string' || !cardUniqueId || typeof tag !== 'string' || !tag) return null;
  if (scope !== undefined && !SCOPES.includes(scope as FacetAssignScope)) return null;
  return { cardUniqueId, tag, scope: scope as FacetAssignScope | undefined };
}

// POST /api/admin/card-facets/assign — add one tag to a card.
// scope 'name' (default) fans out to all same-name variants; 'card' targets one card_unique_id.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const parsed = parseBody(body);
  if (!parsed) return NextResponse.json({ error: "cardUniqueId and tag are required; scope must be 'name' or 'card'" }, { status: 400 });

  const result = parsed.scope
    ? await facetService.addCardFacetTag(parsed.cardUniqueId, parsed.tag, parsed.scope)
    : await facetService.addCardFacetTag(parsed.cardUniqueId, parsed.tag);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// DELETE /api/admin/card-facets/assign — remove one tag from a card; same scope semantics as POST.
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const parsed = parseBody(body);
  if (!parsed) return NextResponse.json({ error: "cardUniqueId and tag are required; scope must be 'name' or 'card'" }, { status: 400 });

  const result = parsed.scope
    ? await facetService.removeCardFacetTag(parsed.cardUniqueId, parsed.tag, parsed.scope)
    : await facetService.removeCardFacetTag(parsed.cardUniqueId, parsed.tag);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
