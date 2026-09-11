// POST /api/scan/session — the desktop creates a phone-pairing session and
// renders the returned pairUrl as a QR. Signed-in users only.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { getScanSessionStore, SCAN_SESSION_TTL_SEC } from '@/lib/scan/session-store';
import { pairBaseUrlForRequest } from '@/lib/scan/pair-url';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, {});
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const session = await getScanSessionStore().create(auth.userId!);
    // a phone can't open "localhost": in dev the LAN ip is substituted (see lib/scan/pair-url)
    const pairUrl = `${pairBaseUrlForRequest(request.nextUrl.origin)}/scan?pair=${session.code}`;
    return NextResponse.json({ success: true, data: { code: session.code, pairUrl, expiresInSec: SCAN_SESSION_TTL_SEC } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create scan session' }, { status: 500 });
  }
}
