import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';

async function checkCuratorOrAdmin(req: NextRequest, body?: object) {
  const authResult = await authenticateRequest(req, body ?? {});
  if (!authResult.success) {
    return { authorized: false, status: 401, error: 'Authentication required' };
  }

  const [curatorCheck, adminCheck] = await Promise.all([
    userService.hasRole(authResult.userId!, 'isCurator'),
    userService.hasRole(authResult.userId!, 'isSuperAdmin'),
  ]);
  const isCurator = !!(curatorCheck.success && curatorCheck.data);
  const isSuperAdmin = !!(adminCheck.success && adminCheck.data);

  if (!isCurator && !isSuperAdmin) {
    return { authorized: false, status: 403, error: 'Curator or Super Admin role required' };
  }

  return { authorized: true };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const result = await curatedListService.getListById(params.listId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const body = await req.json();
    const auth = await checkCuratorOrAdmin(req, body);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const result = await curatedListService.updateList(params.listId, body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const auth = await checkCuratorOrAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const result = await curatedListService.deleteList(params.listId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
