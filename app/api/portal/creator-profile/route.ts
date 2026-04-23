import { NextRequest, NextResponse } from 'next/server';
import { customTokenCardService } from '@/lib/services';
import { requireContentCreatorRole, requireCreatorProfile } from '@/lib/auth/require-creator';

/**
 * GET /api/portal/creator-profile
 *
 * Authenticated. Returns the caller's creator profile, or `data: null` if
 * they haven't created one yet. Requires the `isContentCreator` role.
 */
export async function GET(req: NextRequest) {
  const gate = await requireContentCreatorRole(req);
  if (!gate.success) return gate.response;

  const result = await customTokenCardService.getCreatorByUserId(gate.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

/**
 * POST /api/portal/creator-profile
 *
 * Authenticated. Creates a creator profile for the caller.
 * Requires the `isContentCreator` role. Enforces 1:1 with user.
 */
export async function POST(req: NextRequest) {
  const gate = await requireContentCreatorRole(req);
  if (!gate.success) return gate.response;

  const body = await req.json().catch(() => ({}));
  const result = await customTokenCardService.createCreatorProfile(gate.userId, body);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}

/**
 * PATCH /api/portal/creator-profile
 *
 * Authenticated. Updates the caller's creator profile.
 * Requires the `isContentCreator` role AND an existing profile.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireCreatorProfile(req);
  if (!gate.success) return gate.response;

  const body = await req.json().catch(() => ({}));
  const result = await customTokenCardService.updateCreatorProfile(gate.creator.id, body);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
