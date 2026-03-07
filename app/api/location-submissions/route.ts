import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

// POST — public, no auth required
export async function POST(request: NextRequest) {
  const body = await request.json();

  const required = ['submitterName', 'submitterEmail', 'submitterRelationship',
    'storeName', 'storeAddressLine1', 'storeAddressCity',
    'storeAddressState', 'storeAddressPostalCode', 'storeAddressCountry'];

  for (const field of required) {
    if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }

  const result = await locationService.createSubmission(body);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}

// GET — admin only
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const canResult = await locationService.canManageLocation(authResult.userId, '*');
  if (!canResult.success || !canResult.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const result = await locationService.listSubmissions(
    { status: (searchParams.get('status') as any) || undefined },
    {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
