// app/api/admin/scan/hashes/route.ts — load / inspect the card-scanner hash index.
// The prod image has no scripts or tsx, so the index is built LOCALLY
// (scripts/compute-image-hashes.ts) and pushed here by scripts/push-image-hashes.ts
// with a superadmin bearer. GET doubles as the "did migration 0109 apply?" probe.
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { scanService } from '@/lib/services';
import { validateHashRows } from '@/lib/scan/hash-rows';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  const counts = await scanService.countHashes();
  if (!counts.success) {
    const missing = /does not exist/i.test(counts.error);
    return NextResponse.json({ error: counts.error, ...(missing ? { hint: 'printing_image_hashes missing — migration 0109 not applied?' } : {}) }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: counts.data });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch { /* validated below */ }
  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  const validated = validateHashRows(body?.rows);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const dryRun = !!body?.dryRun;

  // An unknown printing id would roll back the whole batch on the FK: split first.
  const known = await scanService.filterKnownPrintingIds(validated.rows.map(r => r.printingId));
  if (!known.success) return NextResponse.json({ error: known.error }, { status: 500 });
  const rows = validated.rows.filter(r => known.data.has(r.printingId));
  const unknown = validated.rows.filter(r => !known.data.has(r.printingId)).map(r => r.printingId);

  let upserted = 0;
  if (!dryRun && rows.length > 0) {
    const res = await scanService.upsertHashes(rows);
    if (!res.success) return NextResponse.json({ error: res.error }, { status: 500 });
    upserted = res.data.upserted;
    scanService.clearIndexCache();
  }
  return NextResponse.json({
    success: true,
    data: { dryRun, received: validated.rows.length, upserted, unknownCount: unknown.length, unknownPrintingIds: unknown.slice(0, 50) },
  });
}
