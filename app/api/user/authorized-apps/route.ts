// GET /api/user/authorized-apps — apps the signed-in user has allowed to act
// for them (OAuth grants), with what each may do in plain words. Shown on
// Profile → Connected accounts. Session only: an app must not be able to list
// or revoke other apps' access.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { oauthService } from '@/lib/services';
import { classifyScopeRequest, consentLines } from '@/lib/oauth/consent';

function hostOf(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await oauthService.listAuthorizedApps(session.user.id);
    if (!result.success) {
      console.error('[AuthorizedApps] list failed:', result.error);
      return NextResponse.json({ error: 'Could not load connected apps' }, { status: 500 });
    }

    const data = result.data.map(app => {
      const grants = app.scopes.map(classifyScopeRequest);
      const full = grants.find(grant => grant.kind === 'full');
      // Several limited grants to one app add up to the union of their scopes.
      const combined = full ?? classifyScopeRequest(app.scopes.join(' '));
      return {
        client_id: app.client_id,
        name: app.client_name,
        site: hostOf(app.client_uri),
        full_access: combined.kind === 'full',
        permissions: consentLines(combined),
        authorized_at: app.authorized_at.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[AuthorizedApps] list error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
