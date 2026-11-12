// DELETE /api/user/authorized-apps/{clientId} — remove the signed-in user's
// access grant to one app. The app itself and other users are unaffected.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { oauthService } from '@/lib/services';

export async function DELETE(_req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await params;
    const result = await oauthService.revokeAppAccess(session.user.id, clientId);
    if (!result.success) {
      return NextResponse.json({ error: 'No access to remove' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AuthorizedApps] revoke error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
