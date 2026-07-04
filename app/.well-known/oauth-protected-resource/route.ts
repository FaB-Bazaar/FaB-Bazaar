/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * https://datatracker.ietf.org/doc/html/rfc9728
 *
 * This endpoint tells OAuth clients (like Claude Code) which authorization
 * server protects this resource, enabling automatic OAuth discovery.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Derive base URL from forwarded headers (same pattern as oauth-authorization-server)
  // so the metadata is correct behind any host: prod Caddy, ngrok tunnels, localhost.
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost || url.host;
  const protocol = forwardedProto || url.protocol.replace(':', '');
  const BASE_URL = `${protocol}://${host}`;

  const metadata = {
    resource: `${BASE_URL}/api/mcp/server`,
    authorization_servers: [BASE_URL],
    scopes_supported: ['read', 'write', 'claudeai'],
    bearer_methods_supported: ['header'],
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
