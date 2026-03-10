import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { listId: string; cardId: string } }
) {
  try {
    const authResult = await authenticateRequest(req, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userResult = await userService.getProfile(authResult.userId!);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    const profile = userResult.data;
    const isCurator = profile.isCurator || false;
    const isSuperAdmin = profile.roles?.isSuperAdmin || false;

    if (!isCurator && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Curator or Super Admin role required' }, { status: 403 });
    }

    const result = await curatedListService.removeCard(params.cardId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
