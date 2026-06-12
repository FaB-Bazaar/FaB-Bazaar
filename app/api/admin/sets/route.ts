// app/api/admin/sets/route.ts
// Superadmin: list all sets (reference data for the /admin/sets ordering page).

import { NextResponse } from 'next/server';
import { setsService, userService } from '@/lib/services';
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

export async function GET() {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await setsService.listSets();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
