// GET /api/admin/scan/captures/[id] — the original photo bytes of one capture.
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { getScanCaptureStore } from '@/lib/scan/capture-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const hit = await getScanCaptureStore().get(gate.userId, id);
  if (!hit) return NextResponse.json({ error: 'Capture not found or expired' }, { status: 404 });
  return new Response(Buffer.from(hit.data), { status: 200, headers: { 'Content-Type': hit.contentType, 'Cache-Control': 'private, no-store' } });
}
