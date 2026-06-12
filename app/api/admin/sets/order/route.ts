// app/api/admin/sets/order/route.ts
// Superadmin: transactionally renumber sets.display_order (curated printing
// display ordering). The constants snapshot must be regenerated afterwards
// for client-side sorting to pick the new order up — see
// scripts/generate-set-constants.ts.

import { NextRequest, NextResponse } from 'next/server';
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

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const orders = body?.orders;
  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: 'orders must be a non-empty array' }, { status: 400 });
  }
  for (const o of orders) {
    if (typeof o?.code !== 'string' || typeof o?.displayOrder !== 'number') {
      return NextResponse.json(
        { error: 'each order needs a string code and a numeric displayOrder' },
        { status: 400 },
      );
    }
  }

  const result = await setsService.reorderSets(orders);
  if (!result.success) {
    // The service validates codes/uniqueness — failures are caller errors
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
