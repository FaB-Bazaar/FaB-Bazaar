// app/oauth/token/route.ts
import { NextResponse } from "next/server";
import { oauthFlowService } from '@/lib/services';

async function handleAuthorizationCodeGrant(body: FormData) {
  const code = body.get('code') as string;
  const clientId = body.get('client_id') as string;
  const clientSecret = body.get('client_secret') as string;
  const codeVerifier = body.get('code_verifier') as string;
  const redirectUri = body.get('redirect_uri') as string;

  console.log('🔄 Processing authorization code grant:', {
    code: code?.substring(0, 10) + '...',
    clientId,
    hasSecret: !!clientSecret,
    hasVerifier: !!codeVerifier,
    redirectUri
  });

  if (!code || !clientId || !redirectUri) {
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing required parameters: code, client_id, and redirect_uri are required'
    }, { status: 400 });
  }

  // Exchange authorization code for tokens using service layer
  const result = await oauthFlowService.exchangeAuthorizationCode({
    code,
    clientId,
    clientSecret: clientSecret || undefined,
    redirectUri,
    codeVerifier: codeVerifier || undefined,
  });

  if (!result.success) {
    console.log(`❌ Token exchange failed: ${result.error}`);

    // Map service errors to OAuth error codes
    const errorCode = result.error?.includes('expired') ? 'invalid_grant' :
                      result.error?.includes('credentials') ? 'invalid_client' :
                      result.error?.includes('verifier') ? 'invalid_grant' :
                      result.error?.includes('already used') ? 'invalid_grant' :
                      'server_error';

    const statusCode = errorCode === 'invalid_client' ? 401 :
                       errorCode === 'server_error' ? 500 : 400;

    return NextResponse.json({
      error: errorCode,
      error_description: result.error
    }, { status: statusCode });
  }

  console.log(`✅ Tokens generated successfully`);

  return NextResponse.json(result.data, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }
  });
}

async function handleClientCredentialsGrant(body: FormData) {
  const clientId = body.get('client_id') as string;
  const clientSecret = body.get('client_secret') as string;
  const scope = body.get('scope') as string || 'read write';

  console.log('🔄 Processing client credentials grant:', { clientId, scope });

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing client credentials'
    }, { status: 400 });
  }

  // Generate token using service layer
  const result = await oauthFlowService.generateClientCredentialsToken(clientId, clientSecret, scope);

  if (!result.success) {
    console.log(`❌ Client credentials grant failed: ${result.error}`);
    return NextResponse.json({
      error: 'invalid_client',
      error_description: result.error
    }, { status: 401 });
  }

  console.log(`✅ Client credentials token generated`);

  return NextResponse.json(result.data, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }
  });
}

async function handleRefreshTokenGrant(body: FormData) {
  const refreshToken = body.get('refresh_token') as string;
  const clientId = body.get('client_id') as string;

  console.log('🔄 Processing refresh token grant:', { clientId, hasRefreshToken: !!refreshToken });

  if (!refreshToken || !clientId) {
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing refresh_token or client_id'
    }, { status: 400 });
  }

  // Refresh access token using service layer
  const result = await oauthFlowService.refreshAccessToken(refreshToken, clientId);

  if (!result.success) {
    console.log(`❌ Token refresh failed: ${result.error}`);
    return NextResponse.json({
      error: 'invalid_grant',
      error_description: result.error
    }, { status: 400 });
  }

  console.log(`✅ Tokens refreshed successfully`);

  return NextResponse.json(result.data, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type');
    
    let body: FormData;
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      body = await req.formData();
    } else if (contentType?.includes('application/json')) {
      // Also accept JSON for convenience
      const jsonBody = await req.json();
      body = new FormData();
      for (const [key, value] of Object.entries(jsonBody)) {
        body.append(key, value as string);
      }
    } else {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'Content-Type must be application/x-www-form-urlencoded or application/json'
      }, { status: 400 });
    }
    
    const grantType = body.get('grant_type') as string;
    
    console.log('🔄 OAuth token request:', { grantType, contentType });
    
    switch (grantType) {
      case 'authorization_code':
        return await handleAuthorizationCodeGrant(body);
      case 'client_credentials':
        return await handleClientCredentialsGrant(body);
      case 'refresh_token':
        return await handleRefreshTokenGrant(body);
      default:
        return NextResponse.json({
          error: 'unsupported_grant_type',
          error_description: `Grant type '${grantType}' is not supported. Supported types: authorization_code, client_credentials, refresh_token`
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('💥 Error parsing token request:', error);
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Invalid request format'
    }, { status: 400 });
  }
}
