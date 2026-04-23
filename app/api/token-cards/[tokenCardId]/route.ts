import { NextResponse } from 'next/server';
import { customTokenCardService } from '@/lib/services';

/**
 * GET /api/token-cards/[tokenCardId]
 *
 * Public. Returns a single custom token card with hydrated linked card metadata.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tokenCardId: string }> }
) {
  const { tokenCardId } = await params;

  const result = await customTokenCardService.getTokenCardById(tokenCardId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: 'Token card not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
