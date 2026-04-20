import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';
import { checkListOwnership } from '../../curation-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const body = await req.json();

    const authResult = await authenticateRequest(req, body, { allowOAuth: true });
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

    const { printingId, printingIds } = body;

    if (Array.isArray(printingIds) && printingIds.length > 0) {
      const result = await curatedListService.addCards(params.listId, printingIds);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      revalidateTag('kits-summary');
      return NextResponse.json({ success: true, data: result.data }, { status: 201 });
    }

    if (!printingId) {
      return NextResponse.json({ success: false, error: 'printingId or printingIds is required' }, { status: 400 });
    }

    const result = await curatedListService.addCard(params.listId, printingId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    revalidateTag('kits-summary');
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
