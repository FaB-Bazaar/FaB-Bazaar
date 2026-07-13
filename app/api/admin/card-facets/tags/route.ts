import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import { requireFacetManager } from '../_auth';

// GET /api/admin/card-facets/tags — all tag definitions with usage counts
export async function GET(request: NextRequest) {
  const gate = await requireFacetManager(request);
  if (!gate.ok) return gate.response;

  const result = await facetService.getTagUsageCounts();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// POST /api/admin/card-facets/tags — create a tag definition
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const { id, dim, label, def, draft } = body as Record<string, unknown>;
  if (typeof id !== 'string' || typeof dim !== 'string' || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'id, dim and label are required' }, { status: 400 });
  }

  const result = await facetService.createTagDefinition({
    id,
    dim: dim as any,
    label,
    def: typeof def === 'string' ? def : undefined,
    draft: typeof draft === 'boolean' ? draft : undefined,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// PATCH /api/admin/card-facets/tags — edit an existing tag definition (label/def/dim/draft).
// The slug id is immutable; assignments keyed off it are untouched.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireFacetManager(request, body);
  if (!gate.ok) return gate.response;

  const { id, dim, label, def, draft } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const result = await facetService.updateTagDefinition(id, {
    dim: typeof dim === 'string' ? (dim as any) : undefined,
    label: typeof label === 'string' ? label : undefined,
    def: typeof def === 'string' ? def : undefined,
    draft: typeof draft === 'boolean' ? draft : undefined,
  });
  if (!result.success) {
    const status = /not found/i.test(result.error) ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// DELETE /api/admin/card-facets/tags?id=... — delete a tag definition (only if unassigned)
export async function DELETE(request: NextRequest) {
  const gate = await requireFacetManager(request);
  if (!gate.ok) return gate.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const result = await facetService.deleteTagDefinition(id);
  if (!result.success) {
    // Assigned tags can't be deleted — surface as a conflict.
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
