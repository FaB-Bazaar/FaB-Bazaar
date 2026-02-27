/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414)
 * https://datatracker.ietf.org/doc/html/rfc8414
 *
 * This endpoint tells OAuth clients (like Claude) where to find
 * the authorization and token endpoints.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Use forwarded headers from ngrok/proxy if available
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  const host = forwardedHost || url.host;
  const protocol = forwardedProto || url.protocol.replace(':', '');
  const baseUrl = `${protocol}://${host}`;

  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,

    // Supported grant types
    grant_types_supported: [
      'authorization_code',
      'client_credentials',
      'refresh_token',
    ],

    // Supported response types
    response_types_supported: ['code', 'token'],

    // PKCE support
    code_challenge_methods_supported: ['S256', 'plain'],

    // Token endpoint auth methods
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],

    // Scopes
    scopes_supported: ['read', 'write', 'claudeai'],

    // Service documentation
    service_documentation: `${baseUrl}/docs/oauth`,
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
