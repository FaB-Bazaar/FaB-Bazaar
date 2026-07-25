import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { feedOverridesService } from '@/lib/services';
import type { UpdateFeedOverrideInput } from '@/lib/services/postgres/feed-overrides/PostgresFeedOverridesService';

/**
 * PATCH /api/admin/feed-overrides/[id] — update setFields / reason / active.
 * DELETE — remove the override. Superadmin only. Match-key fields are
 * immutable — delete and recreate to retarget an override.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: UpdateFeedOverrideInput & Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body → no-op update, service handles it
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const patch: UpdateFeedOverrideInput = {
    ...(body.setFields !== undefined ? { setFields: body.setFields as Record<string, unknown> } : {}),
    ...(body.reason !== undefined ? { reason: String(body.reason) } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  };

  const result = await feedOverridesService.update(id, patch);
  if (!result.success) {
    const status = result.error === 'Feed override not found' ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const result = await feedOverridesService.delete(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: undefined });
}
