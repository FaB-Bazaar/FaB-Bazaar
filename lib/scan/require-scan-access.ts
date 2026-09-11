// lib/scan/require-scan-access.ts — server-side scanner gate for the /api/scan/* routes.
// Kept apart from scan-access.ts so the client bundle never imports @/lib/services.
import { NextResponse, type NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';
import { canUseScanner, SCAN_ROLLOUT } from './scan-access';

export type ScanAccessGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireScanAccess(request: NextRequest, body: unknown = {}, opts: { allowOAuth?: boolean } = {}): Promise<ScanAccessGate> {
  const auth = await authenticateRequest(request, body, opts);
  if (!auth.success || !auth.userId) {
    return { ok: false, response: NextResponse.json({ error: auth.error ?? 'Authentication required' }, { status: 401 }) };
  }
  if (SCAN_ROLLOUT !== 'everyone') {
    const roles = await userService.getRoles(auth.userId);
    const flags = roles.success ? roles.data : null; // a failed lookup denies
    if (!canUseScanner(flags)) {
      return { ok: false, response: NextResponse.json({ error: 'The card scanner is not available on your account yet' }, { status: 403 }) };
    }
  }
  return { ok: true, userId: auth.userId };
}
