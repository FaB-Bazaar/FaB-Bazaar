import { NextRequest, NextResponse } from 'next/server';
import { foilMaskService } from '@/lib/services';
import { requireSuperAdmin } from '../../require-superadmin';

/** Revert a recorded bulk apply from the prior values stored alongside it. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { opId } = (body ?? {}) as Record<string, unknown>;
  if (typeof opId !== 'string' || !opId) {
    return NextResponse.json({ error: 'opId is required' }, { status: 400 });
  }

  const result = await foilMaskService.undoOp(opId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
