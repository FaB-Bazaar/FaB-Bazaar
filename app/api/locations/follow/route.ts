import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

// POST /api/locations/follow  body: { locationId, action: 'follow' | 'unfollow' }
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const body = await request.json();
  const { locationId, action } = body;

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  const result = action === 'unfollow'
    ? await locationService.unfollowLocation(authResult.userId, locationId)
    : await locationService.followLocation(authResult.userId, locationId);

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
