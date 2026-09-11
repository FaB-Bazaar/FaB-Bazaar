// GET /api/admin/scan/captures — the caller's recent scan photos (rollout diagnostics), newest first.
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { getScanCaptureStore } from '@/lib/scan/capture-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  const captures = await getScanCaptureStore().list(gate.userId);
  return NextResponse.json({ success: true, data: { captures: captures.map(c => ({ ...c, url: `/api/admin/scan/captures/${c.id}` })) } });
}
