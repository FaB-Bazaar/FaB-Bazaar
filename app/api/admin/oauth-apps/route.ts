// /api/admin/oauth-apps — the OAuth app allow-list (migration 0136), for
// /admin/oauth-apps. Superadmin, browser session only (see _session.ts).
//
// GET ?view=waiting|all&page=N: the entries + one page (20) of registered
//      apps — by default only those nothing on the list approves (where a
//      new partner shows up); view=all is every registration. Each says what
//      it is approved for and whether it may be deleted (no live connection,
//      not approved by client id).
// POST { kind, value, label, access }: add an entry.
import { NextRequest, NextResponse } from 'next/server';
import { oauthFlowService } from '@/lib/services';
import { isApproved, redirectHost } from '@/lib/oauth/allowlist';
import { requireSuperAdminSession } from './_session';

const PAGE_SIZE = 20;
const KINDS = new Set(['redirect_host', 'client_id']);
const ACCESS = new Set(['full', 'partner', 'all']);

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminSession();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const view = url.searchParams.get('view') === 'all' ? 'all' : 'waiting';
  const requested = Number.parseInt(url.searchParams.get('page') ?? '', 10);

  const [entries, clients] = await Promise.all([oauthFlowService.listAllowlist(), oauthFlowService.listRegisteredClients()]);
  if (!entries.success || !clients.success) {
    return NextResponse.json({ error: 'Could not load the apps' }, { status: 500 });
  }

  const listedById = new Set(entries.data.filter(e => e.kind === 'client_id').map(e => e.value));
  const all = clients.data.map(app => {
    const clientApp = { clientId: app.clientId, redirectUris: app.redirectUris };
    return {
      clientId: app.clientId,
      name: app.clientName,
      site: app.clientUri ? redirectHost(app.clientUri) : null,
      returnHosts: [...new Set(app.redirectUris.map(uri => redirectHost(uri) ?? uri))],
      registeredAt: app.createdAt.toISOString(),
      lastUsed: app.lastUsed ? app.lastUsed.toISOString() : null,
      liveConnections: app.liveConnections,
      approved: { full: isApproved(clientApp, 'full', entries.data), partner: isApproved(clientApp, 'partner', entries.data) },
      canDelete: app.liveConnections === 0 && !listedById.has(app.clientId),
    };
  });
  const waiting = all.filter(app => !app.approved.full && !app.approved.partner);
  const shown = view === 'all' ? all : waiting;

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const page = Math.min(Number.isFinite(requested) && requested >= 1 ? requested : 1, totalPages);

  return NextResponse.json({
    success: true,
    data: {
      entries: entries.data,
      view,
      waitingCount: waiting.length,
      registrations: shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      pagination: { page, pageSize: PAGE_SIZE, total: shown.length, totalPages },
    },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminSession();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (
    !body || typeof body.kind !== 'string' || !KINDS.has(body.kind)
    || typeof body.value !== 'string' || typeof body.label !== 'string'
    || typeof body.access !== 'string' || !ACCESS.has(body.access)
  ) {
    return NextResponse.json({ error: 'Send { kind, value, label, access }' }, { status: 400 });
  }

  const added = await oauthFlowService.addAllowlistEntry({
    kind: body.kind as 'redirect_host' | 'client_id',
    value: body.value,
    label: body.label,
    access: body.access as 'full' | 'partner' | 'all',
    createdBy: gate.userId,
  });
  if (!added.success) return NextResponse.json({ error: added.error }, { status: 400 });
  return NextResponse.json({ success: true, data: added.data }, { status: 201 });
}
