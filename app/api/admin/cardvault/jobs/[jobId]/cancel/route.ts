import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { cancelCardVaultJob } from '@/lib/import/cardvault-job';

/**
 * POST /api/admin/cardvault/jobs/[jobId]/cancel — stop a running job at its
 * next request boundary (superadmin). An ingest's commit is one transaction,
 * so a cancel never leaves a half-written plan.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  if (!cancelCardVaultJob((await params).jobId)) {
    return NextResponse.json({ error: 'No running job with that id' }, { status: 409 });
  }
  return NextResponse.json({ success: true, data: { cancelRequested: true } });
}
