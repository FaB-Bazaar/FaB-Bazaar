import { NextRequest, NextResponse } from 'next/server';
import { printingsService, userService } from '@/lib/services';
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

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ cardUniqueId: string }> },
) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { cardUniqueId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const value = body?.value;

  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'value must be a boolean' }, { status: 400 });
  }

  const result = await printingsService.setHeroYoung(cardUniqueId, value);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
