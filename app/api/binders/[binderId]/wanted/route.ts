import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';
import { parseTradeMatchMode } from '@/lib/trade/allocate-wants';

/**
 * GET /api/binders/[binderId]/wanted?match=exact|loose
 * The binder's for-trade items on the signed-in viewer's wants list, each with
 * `requestQuantity` = min(wanted, in binder). Backs "Add my wants".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  const { binderId } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error || 'Sign in required' }, { status: 401 });
  }
  const viewerId = authResult.userId;

  const binderResult = await binderService.getBinder(binderId, viewerId);
  if (!binderResult.success) {
    const denied = binderResult.error?.includes('Access denied');
    return NextResponse.json({ error: binderResult.error }, { status: denied ? 403 : 500 });
  }
  const binder = binderResult.data;
  if (!binder) return NextResponse.json({ error: 'Binder not found' }, { status: 404 });

  const level = binder.visibility?.level;
  const viewable =
    binder.userId === viewerId ||
    level === 'public' ||
    level === 'unlisted' ||
    (level === undefined && binder.isPublic);
  if (!viewable) {
    return NextResponse.json({ error: 'Access denied: This binder is private' }, { status: 403 });
  }

  const mode = parseTradeMatchMode(request.nextUrl.searchParams.get('match'));
  const result = await binderService.getWantedItemsInBinder(binder._id, viewerId, mode);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
