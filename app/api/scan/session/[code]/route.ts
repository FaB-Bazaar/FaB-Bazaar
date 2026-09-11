// GET /api/scan/session/[code] — session status (paired? how many items?).
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { getScanSessionStore, loadOwnedSession } from '@/lib/scan/session-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authenticateRequest(request, {});
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { code } = await params;
  const owned = await loadOwnedSession(getScanSessionStore(), code, auth.userId!);
  if (owned.status !== 200) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const items = await getScanSessionStore().listItems(owned.record.code);
  return NextResponse.json({ success: true, data: { code: owned.record.code, paired: owned.record.pairedAt !== null, itemCount: items.length } });
}
