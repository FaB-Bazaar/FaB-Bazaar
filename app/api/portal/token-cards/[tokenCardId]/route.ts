import { NextRequest, NextResponse } from 'next/server';
import { customTokenCardService } from '@/lib/services';
import { requireCreatorProfile } from '@/lib/auth/require-creator';

/**
 * PATCH /api/portal/token-cards/[tokenCardId]
 *
 * Authenticated. Updates a token card. The service enforces ownership:
 * the caller's creator id must match the token card's creator id.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tokenCardId: string }> }
) {
  const gate = await requireCreatorProfile(req);
  if (!gate.success) return gate.response;

  const { tokenCardId } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await customTokenCardService.updateTokenCard(gate.creator.id, tokenCardId, body);
  if (!result.success) {
    const status =
      result.error?.match(/not found/i) ? 404 :
      result.error?.match(/not authorized/i) ? 403 :
      400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ success: true, data: result.data });
}

/**
 * DELETE /api/portal/token-cards/[tokenCardId]
 *
 * Authenticated. Deletes a token card the caller owns.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenCardId: string }> }
) {
  const gate = await requireCreatorProfile(req);
  if (!gate.success) return gate.response;

  const { tokenCardId } = await params;
  const result = await customTokenCardService.deleteTokenCard(gate.creator.id, tokenCardId);
  if (!result.success) {
    const status =
      result.error?.match(/not found/i) ? 404 :
      result.error?.match(/not authorized/i) ? 403 :
      400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ success: true });
}
