import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { inventoryService } from '@/lib/services';

// Card-first "who at this store has what I want" — the viewer's wants list
// matched against store followers' for-trade inventory. Auth required (it
// reads the viewer's own wants).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: storeId } = await params;

  const result = await inventoryService.getStoreWantMatches(storeId, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, data: result.data },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
