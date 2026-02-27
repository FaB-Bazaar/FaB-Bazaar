// app/oauth/register/route.ts
import { NextResponse } from "next/server";
import { oauthFlowService } from '@/lib/services';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log('🔧 OAuth client registration request:', body);

    // Validate required fields
    if (!body.client_name) {
      return NextResponse.json({
        error: "invalid_client_metadata",
        error_description: "client_name is required"
      }, { status: 400 });
    }

    // Register client using service layer
    const result = await oauthFlowService.registerClient({
      client_name: body.client_name,
      redirect_uris: body.redirect_uris || [],
      token_endpoint_auth_method: body.token_endpoint_auth_method,
      grant_types: body.grant_types,
      response_types: body.response_types,
      scope: body.scope,
      client_uri: body.client_uri,
    });

    if (!result.success) {
      console.log(`❌ Client registration failed: ${result.error}`);

      // Map service errors to OAuth error codes
      const errorCode = result.error?.includes('redirect') ? 'invalid_redirect_uri' : 'server_error';

      return NextResponse.json({
        error: errorCode,
        error_description: result.error
      }, { status: 400 });
    }

    console.log(`✅ OAuth client registered: ${result.data.client_id} (${result.data.client_name})`);

    return NextResponse.json(result.data, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (parseError) {
    console.error('💥 Error parsing registration request:', parseError);
    return NextResponse.json({
      error: "invalid_request",
      error_description: "Invalid JSON in request body"
    }, { status: 400 });
  }
}

// Handle CORS for OAuth endpoints
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    },
  });
}