import { NextRequest, NextResponse } from 'next/server';
import { curatorHeroAssignmentService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

async function requireSuperAdmin() {
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return { error: 'Unauthorized', status: 401 } as const;
  }

  const rolesResult = await userService.getRoles(authResult.userId);
  if (!rolesResult.success || !rolesResult.data?.isSuperAdmin) {
    return { error: 'Forbidden', status: 403 } as const;
  }

  return { userId: authResult.userId } as const;
}

export async function GET(_request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await curatorHeroAssignmentService.getAllAssignments();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { userId, heroName, metafyProductUrl, metafyLinkLabel } = body;

  if (!userId || !heroName) {
    return NextResponse.json({ error: 'userId and heroName are required' }, { status: 400 });
  }

  const result = await curatorHeroAssignmentService.assign(userId, heroName, metafyProductUrl, metafyLinkLabel);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { userId, heroName, metafyProductUrl, metafyLinkLabel } = body;

  if (!userId || !heroName) {
    return NextResponse.json({ error: 'userId and heroName are required' }, { status: 400 });
  }

  const result = await curatorHeroAssignmentService.updateMetafyLink(userId, heroName, metafyProductUrl ?? null, metafyLinkLabel);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { userId, heroName } = body;

  if (!userId || !heroName) {
    return NextResponse.json({ error: 'userId and heroName are required' }, { status: 400 });
  }

  const result = await curatorHeroAssignmentService.unassign(userId, heroName);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
