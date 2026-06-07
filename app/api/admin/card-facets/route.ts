import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { printingsService, userService } from '@/lib/services';

/** Confirm the request is from an authenticated superadmin. */
async function requireSuperAdmin(request: NextRequest, body: unknown = {}) {
  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return { ok: false as const, response: NextResponse.json({ error: authResult.error }, { status: 401 }) };
  }
  const roleCheck = await userService.hasRole(authResult.userId, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const, userId: authResult.userId };
}

// GET /api/admin/card-facets?cardUniqueId=... — current facet tags for a card
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
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

  const gate = await requireSuperAdmin(request, body);
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
