/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * https://datatracker.ietf.org/doc/html/rfc9728
 *
 * This endpoint tells OAuth clients (like Claude Code) which authorization
 * server protects this resource, enabling automatic OAuth discovery.
 */

import { NextResponse } from 'next/server';

const BASE_URL = 'https://fabbazaar.app';

export async function GET() {
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
