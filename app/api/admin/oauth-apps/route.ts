// /api/admin/oauth-apps — the OAuth app allow-list (migration 0136), for
// /admin/oauth-apps. Superadmin, browser session only (see _session.ts).
//
// GET: the entries + the most recently registered apps, each with what the
//      list currently approves it for.
// POST { kind, value, label, access }: add an entry.
import { NextRequest, NextResponse } from 'next/server';
import { oauthFlowService } from '@/lib/services';
import { isApproved, redirectHost } from '@/lib/oauth/allowlist';
import { requireSuperAdminSession } from './_session';

const RECENT_APPS = 100;
const KINDS = new Set(['redirect_host', 'client_id']);
const ACCESS = new Set(['full', 'partner', 'all']);

export async function GET(_request: NextRequest) {
  const gate = await requireSuperAdminSession();
  if (!gate.ok) return gate.response;

  const [entries, recent] = await Promise.all([oauthFlowService.listAllowlist(), oauthFlowService.listRecentClients(RECENT_APPS)]);
  if (!entries.success || !recent.success) {
    return NextResponse.json({ error: 'Could not load the apps' }, { status: 500 });
  }

  const recentApps = recent.data.map(app => {
    const clientApp = { clientId: app.clientId, redirectUris: app.redirectUris };
    return {
      clientId: app.clientId,
      name: app.clientName,
      site: app.clientUri ? redirectHost(app.clientUri) : null,
      returnHosts: [...new Set(app.redirectUris.map(uri => redirectHost(uri) ?? uri))],
      registeredAt: app.createdAt.toISOString(),
      lastUsed: app.lastUsed ? app.lastUsed.toISOString() : null,
      approved: { full: isApproved(clientApp, 'full', entries.data), partner: isApproved(clientApp, 'partner', entries.data) },
    };
  });

  return NextResponse.json({ success: true, data: { entries: entries.data, recentApps } });
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
