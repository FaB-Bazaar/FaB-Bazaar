import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from './_auth';
import { feedOverridesService } from '@/lib/services';
import type { CreateFeedOverrideInput } from '@/lib/services/postgres/feed-overrides/PostgresFeedOverridesService';

/**
 * GET /api/admin/feed-overrides — list all overrides (superadmin only).
 * POST — create one. Overrides patch the fab-cube feed in pipeline step 002
 * before price lookup; see migration 0095.
 */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;

  const result = await feedOverridesService.list();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  let body: Partial<CreateFeedOverrideInput> = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  if (!body.collectorNumber || typeof body.collectorNumber !== 'string' || !body.collectorNumber.trim()) {
    return NextResponse.json({ error: 'collectorNumber is required' }, { status: 400 });
  }
  if (!body.reason || typeof body.reason !== 'string' || !body.reason.trim()) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }
  if (!body.setFields || typeof body.setFields !== 'object') {
    return NextResponse.json({ error: 'setFields is required' }, { status: 400 });
  }

  const result = await feedOverridesService.create({
    collectorNumber: body.collectorNumber,
    edition: body.edition ?? null,
    foiling: body.foiling ?? null,
    language: body.language,
    setFields: body.setFields,
    reason: body.reason,
    createdBy: gate.userId,
  });
  if (!result.success) {
    // Service failures here are validation-shaped (whitelist, duplicates).
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
