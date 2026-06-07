import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

type Gate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Confirm the request is from a user who may manage facets (superadmin OR
 * curator). Shared by every /api/admin/card-facets route.
 */
export async function requireFacetManager(request: NextRequest, body: unknown = {}): Promise<Gate> {
  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return { ok: false, response: NextResponse.json({ error: authResult.error }, { status: 401 }) };
  }
  const superAdmin = await userService.hasRole(authResult.userId, 'isSuperAdmin');
  const curator = await userService.hasRole(authResult.userId, 'isCurator');
  const allowed = (superAdmin.success && superAdmin.data) || (curator.success && curator.data);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: authResult.userId };
}
