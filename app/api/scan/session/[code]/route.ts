// GET /api/scan/session/[code] — session status (paired? how many items?).
import { NextRequest, NextResponse } from 'next/server';
import { requireScanAccess } from '@/lib/scan/require-scan-access';
import { getScanSessionStore, loadOwnedSession } from '@/lib/scan/session-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireScanAccess(request);
  if (!auth.ok) return auth.response;
  const { code } = await params;
  const owned = await loadOwnedSession(getScanSessionStore(), code, auth.userId!);
  if (owned.status !== 200) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const items = await getScanSessionStore().listItems(owned.record.code);
  return NextResponse.json({ success: true, data: { code: owned.record.code, paired: owned.record.pairedAt !== null, itemCount: items.length } });
}
