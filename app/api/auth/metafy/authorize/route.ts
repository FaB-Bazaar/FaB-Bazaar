import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest) {
  const authResult = await authenticateSession();
  if (!authResult.success) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const clientId = process.env.METAFY_CLIENT_ID;
  const redirectUri = process.env.METAFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Metafy integration not configured' }, { status: 500 });
  }

  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'profile community',
    state,
  });

  // Metafy requires %20 for scope separators, not +
  const authUrl = `https://metafy.gg/auth/authorize?${params.toString().replace(/\+/g, '%20')}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('metafy_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  return response;
}
