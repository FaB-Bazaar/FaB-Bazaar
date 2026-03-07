import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

// GET /api/locations?country=US&state=CA&search=...&page=1&limit=20
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const result = await locationService.browseLocations(
    {
      country: searchParams.get('country') || undefined,
      state: searchParams.get('state') || undefined,
      search: searchParams.get('search') || undefined,
      category: (searchParams.get('category') as any) || undefined,
      active: searchParams.get('active') !== 'false',
    },
    {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    }
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}

// POST /api/locations — admin create
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const body = await request.json();

  // Check admin permission via canManageLocation (passing '*' signals global admin check)
  const canResult = await locationService.canManageLocation(authResult.userId, '*');
  if (!canResult.success || !canResult.data) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await locationService.createLocation(body);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
