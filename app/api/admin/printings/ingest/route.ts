import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from './_auth';
import { ingestService } from '@/lib/services';
import type { IngestSetRowsInput } from '@/lib/services/postgres/ingest/PostgresIngestService';

/**
 * POST /api/admin/printings/ingest — remote set ingest (superadmin only).
 *
 * Accepts snake_case cards/printings/card_translations rows exported from
 * another FaB Bazaar database (scripts/push-set-ingest.ts) and upserts them
 * idempotently by natural identity; ids in the payload are local refs only.
 * Replaces the SSH-into-the-VPS step of the ingest-new-set and
 * backfill-printings workflows.
 */
export async function POST(request: NextRequest) {
  let body: Partial<IngestSetRowsInput> = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  if (!body.set || typeof body.set !== 'string' || !body.set.trim()) {
    return NextResponse.json({ error: 'set is required' }, { status: 400 });
  }
  if (!Array.isArray(body.cards) || !Array.isArray(body.printings)) {
    return NextResponse.json({ error: 'cards and printings must be arrays' }, { status: 400 });
  }
  if (body.translations !== undefined && !Array.isArray(body.translations)) {
    return NextResponse.json({ error: 'translations must be an array' }, { status: 400 });
  }

  const result = await ingestService.ingestSetRows({
    set: body.set.trim().toLowerCase(),
    cards: body.cards,
    printings: body.printings,
    translations: body.translations,
    dryRun: !!body.dryRun,
  });
  if (!result.success) {
    // Service failures are validation-shaped (drift guard, unresolved refs).
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
