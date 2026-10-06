import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { cardVaultService } from '@/lib/services';
import { startCardVaultJob, DEFAULT_MAX_REQUESTS, type CardVaultJobAction } from '@/lib/import/cardvault-job';
import { cardVaultJobDeps } from '../_deps';

const ACTIONS: CardVaultJobAction[] = ['preview', 'ingest', 'images', 'probe'];

/**
 * POST /api/admin/cardvault/jobs — start a CardVault ingest job (superadmin).
 * Body: { set, action: preview|ingest|images|probe, maxRequests?, skipCollectors? }.
 * Returns 202 with the job; poll GET /jobs/[jobId]. One job runs at a time (409).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // validated below
  }
  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  const action = body.action as CardVaultJobAction;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 });
  }
  const set = typeof body.set === 'string' ? body.set.trim().toLowerCase() : '';
  if (!/^[a-z0-9]{2,10}$/.test(set)) {
    return NextResponse.json({ error: 'set must be a set code (letters and digits)' }, { status: 400 });
  }
  const maxRequests = body.maxRequests ?? DEFAULT_MAX_REQUESTS;
  if (!Number.isInteger(maxRequests) || (maxRequests as number) < 1 || (maxRequests as number) > 1000) {
    return NextResponse.json({ error: 'maxRequests must be an integer from 1 to 1000' }, { status: 400 });
  }
  const rawSkip = body.skipCollectors ?? [];
  const skipCollectors = Array.isArray(rawSkip)
    ? rawSkip.map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : '')).filter(Boolean)
    : null;
  if (!skipCollectors || skipCollectors.length > 500 || skipCollectors.some((c) => !/^[A-Z0-9-]{2,20}$/.test(c))) {
    return NextResponse.json({ error: 'skipCollectors must be a list of collector numbers (e.g. FAB400)' }, { status: 400 });
  }

  const known = await cardVaultService.getSet(set);
  if (!known.success) return NextResponse.json({ error: known.error }, { status: 500 });
  if (!known.data) {
    return NextResponse.json({ error: `set '${set}' is not registered — add the sets row first` }, { status: 404 });
  }

  const started = startCardVaultJob(
    { set, action, startedBy: gate.userId, maxRequests: maxRequests as number, skipCollectors },
    cardVaultJobDeps(),
  );
  if (!started.success) return NextResponse.json({ error: started.error }, { status: 409 });
  return NextResponse.json({ success: true, data: started.data }, { status: 202 });
}
