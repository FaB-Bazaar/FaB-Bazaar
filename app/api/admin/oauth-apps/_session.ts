// Session-only superadmin gate for /api/admin/oauth-apps. Deliberately NOT
// authenticateRequest: an OAuth or MCP token must never be able to change
// which apps may connect (an app could otherwise approve itself).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

export async function requireSuperAdminSession(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const role = await userService.hasRole(session.user.id, 'isSuperAdmin');
  if (!role.success || !role.data) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true, userId: session.user.id };
}
