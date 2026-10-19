import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';

/**
 * GET /api/change-history
 *
 * The caller's binder change history (last 30 days), newest first.
 * Always the authenticated user's own history — there is no userId parameter.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const result = await binderService.listChangeHistory(authResult.userId!);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
