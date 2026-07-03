// app/api/users/me/route.ts
// Who am I? Identity endpoint for any authenticated credential, including
// OAuth bearer tokens — used by external clients (e.g. play.fabbazaar.app)
// to resolve a token to a fabbazaar user after the OAuth code exchange.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';
import { displayUsername } from '@/lib/utils/display-username';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const result = await userService.findById(authResult.userId!);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // UserAuthDTO keys the user by _id; username may be unset for
  // Discord-provisioned accounts, so fall back before display-stripping.
  const rawName = result.data.username || result.data.discordUsername || 'player';
  return NextResponse.json(
    {
      success: true,
      data: {
        userId: result.data._id,
        username: rawName,
        displayUsername: displayUsername(rawName),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
