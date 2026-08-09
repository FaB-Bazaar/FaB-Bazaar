import { NextRequest, NextResponse } from 'next/server';
import { foilMaskService } from '@/lib/services';
import { requireSuperAdmin } from '../require-superadmin';

/** Named inset presets backing the mask editor's template rail. */
export async function GET(_request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await foilMaskService.listTemplates();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

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

  const { name, notes, sortOrder, top, right, bottom, left, round } = (body ?? {}) as Record<string, unknown>;

  const result = await foilMaskService.createTemplate({
    name: name as string,
    notes: (notes as string | null) ?? null,
    ...(typeof sortOrder === 'number' ? { sortOrder } : {}),
    top: top as number,
    right: right as number,
    bottom: bottom as number,
    left: left as number,
    round: round as string,
    userId: auth.userId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
