import { NextResponse } from 'next/server';
import { customTokenCardService } from '@/lib/services';

/**
 * GET /api/creators
 *
 * Public. Lists all custom-token-card creators (verified first, then newest).
 * Each creator includes a `tokenCardCount` of their published token cards.
 */
export async function GET() {
  const result = await customTokenCardService.listCreators();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
