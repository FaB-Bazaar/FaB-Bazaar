import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';
import { checkListOwnership } from '../../../curation-auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { listId: string; cardId: string } }
) {
  try {
    const authResult = await authenticateRequest(req, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const [curatorCheck, adminCheck] = await Promise.all([
      userService.hasRole(authResult.userId!, 'isCurator'),
      userService.hasRole(authResult.userId!, 'isSuperAdmin'),
    ]);
    const isCurator = !!(curatorCheck.success && curatorCheck.data);
    const isSuperAdmin = !!(adminCheck.success && adminCheck.data);

    if (!isCurator && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Curator or Super Admin role required' }, { status: 403 });
    }

    if (isCurator && !isSuperAdmin) {
      const ownership = await checkListOwnership(authResult.userId!, params.listId);
      if (!ownership.allowed) {
        return NextResponse.json({ success: false, error: ownership.error }, { status: 403 });
      }
    }

    const result = await curatedListService.removeCard(params.cardId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    revalidateTag('kits-summary');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
