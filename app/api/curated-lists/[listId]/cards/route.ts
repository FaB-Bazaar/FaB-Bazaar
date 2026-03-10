import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';

export async function POST(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const body = await req.json();

    const authResult = await authenticateRequest(req, body);
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

    const { printingId } = body;
    if (!printingId) {
      return NextResponse.json({ success: false, error: 'printingId is required' }, { status: 400 });
    }

    const result = await curatedListService.addCard(params.listId, printingId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
