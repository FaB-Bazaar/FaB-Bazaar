// POST /api/scan/session/[code]/pair — the phone announces it has joined.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { getScanSessionStore, loadOwnedSession } from '@/lib/scan/session-store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authenticateRequest(request, {});
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { code } = await params;
  const owned = await loadOwnedSession(getScanSessionStore(), code, auth.userId!);
  if (owned.status !== 200) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const rec = await getScanSessionStore().markPaired(owned.record.code);
  return NextResponse.json({ success: true, data: { code: owned.record.code, paired: rec?.pairedAt !== null } });
}
