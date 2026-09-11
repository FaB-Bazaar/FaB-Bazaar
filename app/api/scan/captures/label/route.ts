// POST /api/scan/captures/label — the user says what a scanned photo really was.
// Body { captureId, printingId, source: 'corrected' | 'accepted' }. Turns normal
// use into ground truth for scripts/scan-eval-captures.ts. Scanner-gated.
import { NextRequest, NextResponse } from 'next/server';
import { requireScanAccess } from '@/lib/scan/require-scan-access';
import { getScanCaptureStore } from '@/lib/scan/capture-store';
import { printingsService } from '@/lib/services';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch { /* validated below */ }
  const auth = await requireScanAccess(request, body);
  if (!auth.ok) return auth.response;
  const { captureId, printingId, source } = body ?? {};
  if (typeof captureId !== 'string' || !captureId || typeof printingId !== 'string' || !printingId || (source !== 'corrected' && source !== 'accepted')) {
    return NextResponse.json({ error: 'captureId, printingId and source (corrected|accepted) are required' }, { status: 400 });
  }
  const printing = await printingsService.getPrintingById(printingId);
  if (!printing.success || !printing.data) return NextResponse.json({ error: 'Unknown printing' }, { status: 404 });
  const ok = await getScanCaptureStore().label(auth.userId, captureId, { printingId, cardName: printing.data.name, source });
  if (!ok) return NextResponse.json({ error: 'Capture not found or expired' }, { status: 404 });
  return NextResponse.json({ success: true, data: { captureId, printingId, source } });
}
