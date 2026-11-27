// DELETE /api/admin/oauth-apps/[id] — take an entry off the OAuth app
// allow-list. Apps it approved stop at their next approval, refresh or
// partner API call. Superadmin, browser session only.
import { NextRequest, NextResponse } from 'next/server';
import { oauthFlowService } from '@/lib/services';
import { requireSuperAdminSession } from '../_session';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminSession();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const result = await oauthFlowService.removeAllowlistEntry(id);
  if (!result.success) return NextResponse.json({ error: 'Could not remove the entry' }, { status: 500 });
  if (!result.data.removed) return NextResponse.json({ error: 'No such entry' }, { status: 404 });
  return NextResponse.json({ success: true, data: { removed: true } });
}
