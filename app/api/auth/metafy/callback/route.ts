import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

const METAFY_TOKEN_URL = 'https://metafy.gg/irk/oauth/token';
const METAFY_ME_URL = 'https://metafy.gg/irk/api/v1/me';
const METAFY_MEMBERSHIPS_URL = 'https://metafy.gg/irk/api/v1/me/community/memberships';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Use forwarded headers so redirects go to the public domain, not the
  // internal container address (0.0.0.0:3000) when behind a reverse proxy
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'fabbazaar.app';
  const origin = `${forwardedProto}://${forwardedHost}`;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('[MetafyCallback] Metafy returned error:', error);
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=${encodeURIComponent(error)}`);
  }

  // Validate state cookie
  const cookieState = request.cookies.get('metafy_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    console.error('[MetafyCallback] State mismatch — possible CSRF');
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=no_code`);
  }

  // User must be logged in to link accounts
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return NextResponse.redirect(`${origin}/login?redirect=/profile/connected-accounts`);
  }

  const clientId = process.env.METAFY_CLIENT_ID;
  const clientSecret = process.env.METAFY_CLIENT_SECRET;
  const redirectUri = process.env.METAFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=not_configured`);
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
      return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=token_exchange_failed`);
    }

    tokenData = await tokenResponse.json();
  } catch (err) {
    console.error('[MetafyCallback] Token exchange error:', err);
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=token_exchange_failed`);
  }

  // Fetch Metafy user profile
  let metafyUser: { id: string; slug?: string; name?: string; partner?: boolean } | null = null;
  try {
    const profileResponse = await fetch(METAFY_ME_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (profileResponse.ok) {
      const data = await profileResponse.json();
      metafyUser = data.user ?? data;
    } else {
      const body = await profileResponse.text();
      console.warn('[MetafyCallback] Could not fetch Metafy profile:', profileResponse.status, body);
    }
  } catch (err) {
    console.warn('[MetafyCallback] Metafy profile fetch error:', err);
  }

  if (!metafyUser?.id) {
    console.error('[MetafyCallback] Could not determine Metafy user ID');
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=no_user_id`);
  }

  const tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);

  const linkResult = await userService.linkMetafyAccount(authResult.userId, {
    metafyId: String(metafyUser.id),
    metafyUsername: metafyUser.slug || metafyUser.name || String(metafyUser.id),
    metafyAccessToken: tokenData.access_token,
    metafyRefreshToken: tokenData.refresh_token,
    metafyTokenExpiry: tokenExpiry,
    metafyPartner: metafyUser.partner ?? false,
  });

  if (!linkResult.success) {
    console.error('[MetafyCallback] Failed to save Metafy link:', linkResult.error);
    return NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=error&reason=save_failed`);
  }

  // Fetch and store community memberships (non-fatal — don't fail the OAuth flow)
  try {
    const membershipsResponse = await fetch(METAFY_MEMBERSHIPS_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (membershipsResponse.ok) {
      const membershipsData = await membershipsResponse.json();
      const communities: { id: string; title: string; tiers?: { id: string; name: string }[] }[] =
        membershipsData.communities ?? [];

      await userService.saveMetafyCommunities(
        authResult.userId,
        communities.map((c) => ({
          communityId: c.id,
          title: c.title,
          tiers: c.tiers?.map((t) => ({ id: t.id, name: t.name })) ?? null,
        }))
      );
    } else {
      console.warn('[MetafyCallback] Could not fetch Metafy memberships:', membershipsResponse.status);
    }
  } catch (err) {
    console.warn('[MetafyCallback] Metafy memberships fetch error:', err);
  }

  const response = NextResponse.redirect(`${origin}/profile/connected-accounts?metafy=linked`);
  response.cookies.delete('metafy_oauth_state');
  return response;
}
