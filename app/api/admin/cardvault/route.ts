import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { cardVaultService } from '@/lib/services';
import { listCardVaultJobs } from '@/lib/import/cardvault-job';
import { cloudflareConfigured } from './_deps';

/**
 * GET /api/admin/cardvault — the /admin/cardvault page's overview (superadmin):
 * registered sets with English coverage, recent jobs (logs omitted; fetch a
 * job by id for its log), and whether image uploads can run here.
 */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;

  const sets = await cardVaultService.listSets();
  if (!sets.success) return NextResponse.json({ error: sets.error }, { status: 500 });

  const jobs = listCardVaultJobs().map(({ log: _log, ...rest }) => rest);
  return NextResponse.json({
    success: true,
    data: { sets: sets.data, jobs, cloudflareConfigured: cloudflareConfigured() },
  });
}
