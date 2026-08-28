import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

type Gate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Confirm the request is from a superadmin. Remote ingest writes card catalog
 * rows, so it is superadmin-only; allowOAuth so the push script can call prod
 * with a bearer token instead of a browser session.
 */
export async function requireSuperAdmin(request: NextRequest, body: unknown = {}): Promise<Gate> {
  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return { ok: false, response: NextResponse.json({ error: authResult.error }, { status: 401 }) };
  }
  const superAdmin = await userService.hasRole(authResult.userId, 'isSuperAdmin');
  if (!superAdmin.success || !superAdmin.data) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: authResult.userId };
}
