// POST /oauth/consent/decision — the consent screen's Allow / Deny form.
//
// This route never issues a code. On Allow it records a short-lived approval
// (a cookie bound to this user, app, scope, callback and PKCE challenge) and
// sends the browser back to /oauth/authorize, which re-validates the whole
// request and issues the code as usual. On Deny it tells the app so.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { oauthFlowService } from '@/lib/services';
import { APPROVAL_COOKIE, APPROVAL_TTL_SECONDS, forwardParams, signApproval } from '@/lib/oauth/consent-gate';

function errorRedirect(baseUrl: string, error: string, description: string) {
  const url = new URL('/oauth/error', baseUrl);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin;

  // Only our own consent page may submit this. (The session cookie is not sent
  // on a cross-site POST either; this is the explicit check.)
  const origin = req.headers.get('origin');
  const ownOrigins = new Set([new URL(baseUrl).origin, new URL(req.url).origin]);
  if (!origin || !ownOrigins.has(origin)) {
    return errorRedirect(baseUrl, 'invalid_request', 'This form can only be submitted from the consent page');
  }

  try {
    const form = await req.formData();
    const params = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') params.set(key, value);
    }
    const backToAuthorize = forwardParams(new URL('/oauth/authorize', baseUrl), params);

    const session = await auth();
    // Signed out: the authorize step owns the sign-in redirect.
    if (!session?.user?.id) return NextResponse.redirect(backToAuthorize, 303);

    const clientId = params.get('client_id');
    if (!clientId) return errorRedirect(baseUrl, 'invalid_request', 'client_id is required');

    // The callback must be one this client registered before we send anyone to it.
    const redirectUriParam = params.get('redirect_uri') || undefined;
    const clientResult = await oauthFlowService.validateClient(clientId, redirectUriParam);
    if (!clientResult.success) {
      return errorRedirect(baseUrl, 'invalid_client', clientResult.error || 'Invalid client_id or redirect_uri');
    }

    if (form.get('decision') !== 'allow') {
      const redirectUri = redirectUriParam ?? clientResult.data.redirect_uris?.[0];
      if (!redirectUri) return errorRedirect(baseUrl, 'access_denied', 'The user denied the request');
      console.log(`🚫 User ${session.user.id} denied access to client: ${clientResult.data.client_name}`);
      const denied = new URL(redirectUri);
      denied.searchParams.set('error', 'access_denied');
      denied.searchParams.set('error_description', 'The user denied the request');
      const state = params.get('state');
      if (state) denied.searchParams.set('state', state);
      return NextResponse.redirect(denied, 303);
    }

    const response = NextResponse.redirect(backToAuthorize, 303);
    response.cookies.set(APPROVAL_COOKIE, signApproval(session.user.id, params), {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(baseUrl).protocol === 'https:',
      path: '/oauth/authorize',
      maxAge: APPROVAL_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('💥 Error handling consent decision:', error);
    return errorRedirect(baseUrl, 'server_error', 'Internal server error during authorization');
  }
}
