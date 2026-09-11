// lib/auth/require-superadmin.ts — shared superadmin gate for admin API routes
// that scripts call with a bearer token (allowOAuth). Same contract as the
// route-local copies under app/api/admin/*/_auth.ts; new routes import this one.
// This is a route helper, not the (locked) auth middleware.
import { NextResponse, type NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

export type SuperAdminGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireSuperAdmin(request: NextRequest, body: unknown = {}): Promise<SuperAdminGate> {
  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return { ok: false, response: NextResponse.json({ error: authResult.error ?? 'Authentication required' }, { status: 401 }) };
  }
  const superAdmin = await userService.hasRole(authResult.userId, 'isSuperAdmin');
  if (!superAdmin.success || !superAdmin.data) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: authResult.userId };
}
