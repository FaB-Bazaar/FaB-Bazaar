import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { collectibleService } from '@/lib/services';
import type { CollectibleSubmissionStatus } from '@/lib/services/contracts/ICollectibleService';

const STATUSES: CollectibleSubmissionStatus[] = ['pending', 'approved', 'rejected'];

/**
 * GET /api/admin/collectibles/submissions — the crowdsourced-submission
 * review queue (superadmin only). Defaults to pending; ?status=approved|
 * rejected shows history, ?status=all shows everything.
 */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;

  const status = new URL(request.url).searchParams.get('status') ?? 'pending';
  if (status !== 'all' && !STATUSES.includes(status as CollectibleSubmissionStatus)) {
    return NextResponse.json(
      { error: "status must be 'pending', 'approved', 'rejected', or 'all'" },
      { status: 400 },
    );
  }

  const result = await collectibleService.listSubmissions(
    status === 'all' ? {} : { status: status as CollectibleSubmissionStatus },
  );
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
