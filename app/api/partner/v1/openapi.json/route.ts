// GET /api/partner/v1/openapi.json — the partner API's OpenAPI description.
// Public: it describes the contract, it returns no user data.
import { NextRequest, NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/partner-api/openapi';

export async function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'fabbazaar.app';
  const protocol = request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return NextResponse.json(buildOpenApiSpec(`${protocol}://${host}`), {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
