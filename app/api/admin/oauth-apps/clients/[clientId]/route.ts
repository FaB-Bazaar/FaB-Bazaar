// DELETE /api/admin/oauth-apps/clients/[clientId] — delete an app
// registration nobody is connected through (old assistant connections, test
// probes). Refused (409) while players are connected or while it is approved
// by client id. Superadmin, browser session only.
import { NextRequest, NextResponse } from 'next/server';
import { oauthFlowService } from '@/lib/services';
import { requireSuperAdminSession } from '../../_session';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const gate = await requireSuperAdminSession();
  if (!gate.ok) return gate.response;

  const { clientId } = await params;
  const result = await oauthFlowService.deleteUnusedClient(clientId);
  if (!result.success) {
    const refused = result.error.startsWith('This app');
    return NextResponse.json({ error: refused ? result.error : 'Could not delete the registration' }, { status: refused ? 409 : 500 });
  }
  if (!result.data.deleted) return NextResponse.json({ error: 'No such app' }, { status: 404 });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
