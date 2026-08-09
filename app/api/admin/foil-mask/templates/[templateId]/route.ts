import { NextRequest, NextResponse } from 'next/server';
import { foilMaskService } from '@/lib/services';
import { requireSuperAdmin } from '../../require-superadmin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { templateId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, notes, sortOrder, top, right, bottom, left, round } = (body ?? {}) as Record<string, unknown>;

  // Only forward the keys actually present — the service treats `undefined` as
  // "leave alone", so spreading nulls would blank fields the caller never sent.
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (notes !== undefined) patch.notes = notes;
  if (sortOrder !== undefined) patch.sortOrder = sortOrder;
  if (top !== undefined) patch.top = top;
  if (right !== undefined) patch.right = right;
  if (bottom !== undefined) patch.bottom = bottom;
  if (left !== undefined) patch.left = left;
  if (round !== undefined) patch.round = round;

  const result = await foilMaskService.updateTemplate(templateId, patch);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { templateId } = await params;

  const result = await foilMaskService.deleteTemplate(templateId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
