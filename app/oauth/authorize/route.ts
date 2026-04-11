// app/oauth/authorize/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { oauthFlowService } from '@/lib/services';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || url.origin;
  const params = {
    client_id: url.searchParams.get('client_id'),
    redirect_uri: url.searchParams.get('redirect_uri'),
    response_type: url.searchParams.get('response_type'),
    scope: url.searchParams.get('scope') || 'read write',
    state: url.searchParams.get('state'),
    code_challenge: url.searchParams.get('code_challenge'),
    code_challenge_method: url.searchParams.get('code_challenge_method')
  };
  
  console.log('🔐 OAuth authorization request:', {
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    response_type: params.response_type,
    scope: params.scope,
    has_code_challenge: !!params.code_challenge,
    code_challenge_method: params.code_challenge_method,
    state: params.state
  });
  
  // Validate required parameters
  if (!params.client_id || !params.response_type) {
    console.log('❌ Missing required parameters');
    const error = new URL('/oauth/error', baseUrl);
    error.searchParams.set('error', 'invalid_request');
    error.searchParams.set('error_description', 'Missing required parameters: client_id and response_type are required');
    return NextResponse.redirect(error);
  }

  // Only support authorization code flow
  if (params.response_type !== 'code') {
    console.log(`❌ Unsupported response_type: ${params.response_type}`);
    const error = new URL('/oauth/error', baseUrl);
    error.searchParams.set('error', 'unsupported_response_type');
    error.searchParams.set('error_description', 'Only "code" response_type is supported');
    return NextResponse.redirect(error);
  }

  // Validate client using service layer
  const clientResult = await oauthFlowService.validateClient(params.client_id, params.redirect_uri);
  if (!clientResult.success) {
    console.log(`❌ Client validation failed for: ${params.client_id}`);
    const error = new URL('/oauth/error', baseUrl);
    error.searchParams.set('error', 'invalid_client');
    error.searchParams.set('error_description', clientResult.error || 'Invalid client_id or redirect_uri');
    return NextResponse.redirect(error);
  }

  const client = clientResult.data;

  // OAuth 2.1 requires PKCE for public clients (token_endpoint_auth_method = 'none')
  if (client.token_endpoint_auth_method === 'none' && !params.code_challenge) {
    const error = new URL('/oauth/error', baseUrl);
    error.searchParams.set('error', 'invalid_request');
    error.searchParams.set('error_description', 'PKCE required for public clients');
    return NextResponse.redirect(error);
  }

  // Check if user is authenticated with NextAuth
  const session = await auth();
  if (!session?.user?.id) {
    console.log('❌ User not authenticated, redirecting to login');
    // Redirect to login with return URL
    const loginUrl = new URL('/api/auth/signin', baseUrl);
    const originalUrl = new URL(req.url);
    const callbackUrl = new URL(originalUrl.pathname + originalUrl.search, baseUrl);
    loginUrl.searchParams.set('callbackUrl', callbackUrl.toString());
    return NextResponse.redirect(loginUrl);
  }
  
  // Generate authorization code using service layer
  try {
    const authCodeResult = await oauthFlowService.createAuthorizationCode({
      clientId: params.client_id!,
      userId: session.user.id,
      redirectUri: params.redirect_uri || client.redirect_uris[0] || '',
      scope: params.scope!,
      codeChallenge: params.code_challenge || undefined,
      codeChallengeMethod: params.code_challenge_method || undefined,
    });

    if (!authCodeResult.success) {
      console.log(`❌ Failed to create authorization code: ${authCodeResult.error}`);
      const error = new URL('/oauth/error', baseUrl);
      error.searchParams.set('error', 'server_error');
      error.searchParams.set('error_description', authCodeResult.error || 'Failed to generate authorization code');
      return NextResponse.redirect(error);
    }

    const { code: authCode, expiresAt } = authCodeResult.data;

    console.log(`✅ Authorization code generated for user: ${session.user.id} client: ${client.client_name}`);
    console.log(`📋 Code expires at: ${expiresAt.toISOString()}`);
    
    // Determine redirect URI - use provided or first registered URI
    let finalRedirectUri = params.redirect_uri;
    if (!finalRedirectUri && client.redirect_uris.length > 0) {
      finalRedirectUri = client.redirect_uris[0];
    }
    
    // Default fallback for testing
    if (!finalRedirectUri) {
  if (process.env.NODE_ENV === 'development') {
    finalRedirectUri = `${baseUrl}/oauth/callback`;
    console.log('⚠️ Using development fallback redirect URI');
  } else {
    console.log('❌ No redirect URI provided and none registered');
    const error = new URL('/oauth/error', baseUrl);
    error.searchParams.set('error', 'invalid_request');
    error.searchParams.set('error_description', 'redirect_uri is required');
    return NextResponse.redirect(error);
  }
}
    
    // Redirect back to client with authorization code
    const redirectUrl = new URL(finalRedirectUri);
    redirectUrl.searchParams.set('code', authCode);
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state);
    }
    
    console.log(`🔄 Redirecting to: ${redirectUrl.toString()}`);
    
    return NextResponse.redirect(redirectUrl);
    
  } catch (error) {
    console.error('💥 Error during authorization:', error);
    const errorUrl = new URL('/oauth/error', baseUrl);
    errorUrl.searchParams.set('error', 'server_error');
    errorUrl.searchParams.set('error_description', 'Internal server error during authorization');
    return NextResponse.redirect(errorUrl);
  }
}

// Handle POST for consent form submissions (future enhancement)
export async function POST(req: Request) {
  console.log('📝 POST request to authorize endpoint - not implemented yet');
  // This would handle explicit user consent if you want a consent page
  // For now, we auto-approve in GET handler
  const error = new URL('/oauth/error', new URL(req.url).origin);
  error.searchParams.set('error', 'method_not_allowed');
  error.searchParams.set('error_description', 'POST method not implemented for authorization endpoint');
  return NextResponse.redirect(error);
}

// Handle CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    },
  });
}
