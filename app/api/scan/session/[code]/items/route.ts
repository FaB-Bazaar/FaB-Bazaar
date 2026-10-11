// POST /api/scan/session/[code]/items — the paired phone sends the cards it read ON THE PHONE (name, pitch, a small crop;
// never the photo). Owner-only like every session route: the code in the QR is not a credential (loadOwnedSession).
import { NextRequest, NextResponse } from 'next/server';
import { requireScanAccess } from '@/lib/scan/require-scan-access';
import { getScanSessionStore, loadOwnedSession, parseSessionItems } from '@/lib/scan/session-store';

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const access = await requireScanAccess(request);
  if (!access.ok) return access.response;
  const store = getScanSessionStore();
  const owned = await loadOwnedSession(store, (await params).code, access.userId);
  if (owned.status !== 200) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const parsed = parseSessionItems(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  for (const item of parsed.items) await store.appendItem(owned.record.code, item);
  return NextResponse.json({ success: true, data: { added: parsed.items.length } });
}
