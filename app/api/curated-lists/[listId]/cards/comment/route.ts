import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const body = await req.json();

  const authResult = await authenticateRequest(req, body);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const [curatorCheck, adminCheck] = await Promise.all([
    userService.hasRole(authResult.userId!, 'isCurator'),
    userService.hasRole(authResult.userId!, 'isSuperAdmin'),
  ]);
  if (!(curatorCheck.success && curatorCheck.data) && !(adminCheck.success && adminCheck.data)) {
    return NextResponse.json({ error: 'Curator or Super Admin role required' }, { status: 403 });
  }

  const { cardName, comment } = body;
  if (!cardName) {
    return NextResponse.json({ error: 'cardName is required' }, { status: 400 });
  }

  const result = await curatedListService.updateCardComment(listId, cardName, comment ?? null);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
