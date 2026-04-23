import { NextRequest, NextResponse } from 'next/server';
import { customTokenCardService } from '@/lib/services';
import { requireCreatorProfile } from '@/lib/auth/require-creator';

/**
 * GET /api/portal/token-cards
 *
 * Authenticated. Lists every token card (drafts + published) for the caller's
 * creator profile. Requires the `isContentCreator` role and an existing profile.
 */
export async function GET(req: NextRequest) {
  const gate = await requireCreatorProfile(req);
  if (!gate.success) return gate.response;

  const result = await customTokenCardService.listTokenCardsByCreator(gate.creator.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

/**
 * POST /api/portal/token-cards
 *
 * Authenticated. Creates a new token card under the caller's creator profile.
 */
export async function POST(req: NextRequest) {
  const gate = await requireCreatorProfile(req);
  if (!gate.success) return gate.response;

  const body = await req.json().catch(() => ({}));
  const result = await customTokenCardService.createTokenCard(gate.creator.id, body);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
