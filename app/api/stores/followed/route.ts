import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { locationService } from '@/lib/services';

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const result = await locationService.getUserFollowedStores(session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, stores: result.data },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } }
  );
}
