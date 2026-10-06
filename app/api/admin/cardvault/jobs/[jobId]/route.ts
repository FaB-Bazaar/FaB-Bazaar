import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { getCardVaultJob } from '@/lib/import/cardvault-job';

/** GET /api/admin/cardvault/jobs/[jobId] — a job's status, progress, log and result (superadmin). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  const job = getCardVaultJob((await params).jobId);
  if (!job) return NextResponse.json({ error: 'Job not found (jobs are lost on restart)' }, { status: 404 });
  return NextResponse.json({ success: true, data: job });
}
