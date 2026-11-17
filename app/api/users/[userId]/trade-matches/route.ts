import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { inventoryService } from '@/lib/services';
import { parseTradeMatchMode } from '@/lib/trade/allocate-wants';

/**
 * GET /api/users/[userId]/trade-matches?match=exact|loose
 * 1:1 trade view between the signed-in viewer and [userId] — what they have
 * that you want, and what you have that they want. Backs /profile/[username]/trade.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error || 'Sign in required' }, { status: 401 });
  }
  if (authResult.userId === targetUserId) {
    return NextResponse.json({ error: "You can't trade with yourself" }, { status: 400 });
  }

  const mode = parseTradeMatchMode(request.nextUrl.searchParams.get('match'));
  const result = await inventoryService.getUserTradeMatches(authResult.userId, targetUserId, mode);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
