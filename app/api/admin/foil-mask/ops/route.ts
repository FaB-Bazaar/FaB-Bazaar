import { NextRequest, NextResponse } from 'next/server';
import { foilMaskService } from '@/lib/services';
import { requireSuperAdmin } from '../require-superadmin';

/** Recent bulk foil-mask applies, newest first — the source for "undo last". */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limitParam = new URL(request.url).searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

  const result = await foilMaskService.listOps(Number.isFinite(limit) ? limit : 20);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
