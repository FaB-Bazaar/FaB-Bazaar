import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

const METAFY_TOKEN_URL = 'https://metafy.gg/irk/oauth/token';
const METAFY_API_BASE = 'https://metafy.gg/api/v1';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('[MetafyCallback] Metafy returned error:', error);
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=${encodeURIComponent(error)}`);
  }

  // Validate state cookie
  const cookieState = request.cookies.get('metafy_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    console.error('[MetafyCallback] State mismatch — possible CSRF');
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=no_code`);
  }

  // User must be logged in to link accounts
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return NextResponse.redirect(`${origin}/login?redirect=/profile/edit`);
  }

  const clientId = process.env.METAFY_CLIENT_ID;
  const clientSecret = process.env.METAFY_CLIENT_SECRET;
  const redirectUri = process.env.METAFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=not_configured`);
  }

  // Exchange code for tokens
  let tokenData: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  try {
    const tokenResponse = await fetch(METAFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error('[MetafyCallback] Token exchange failed:', tokenResponse.status, body);
      return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=token_exchange_failed`);
    }

    tokenData = await tokenResponse.json();
  } catch (err) {
    console.error('[MetafyCallback] Token exchange error:', err);
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=token_exchange_failed`);
  }

  // Fetch Metafy user profile
  let metafyUser: { id: string; slug?: string; username?: string } | null = null;
  try {
    const profileResponse = await fetch(`${METAFY_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (profileResponse.ok) {
      metafyUser = await profileResponse.json();
    } else {
      console.warn('[MetafyCallback] Could not fetch Metafy profile, proceeding without username');
    }
  } catch (err) {
    console.warn('[MetafyCallback] Metafy profile fetch error:', err);
  }

  if (!metafyUser?.id) {
    console.error('[MetafyCallback] Could not determine Metafy user ID');
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=no_user_id`);
  }

  const tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);

  const linkResult = await userService.linkMetafyAccount(authResult.userId, {
    metafyId: String(metafyUser.id),
    metafyUsername: metafyUser.slug || metafyUser.username || String(metafyUser.id),
    metafyAccessToken: tokenData.access_token,
    metafyRefreshToken: tokenData.refresh_token,
    metafyTokenExpiry: tokenExpiry,
  });

  if (!linkResult.success) {
    console.error('[MetafyCallback] Failed to save Metafy link:', linkResult.error);
    return NextResponse.redirect(`${origin}/profile/edit?metafy=error&reason=save_failed`);
  }

  const response = NextResponse.redirect(`${origin}/profile/edit?metafy=linked`);
  response.cookies.delete('metafy_oauth_state');
  return response;
}
