import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { inventoryService } from '@/lib/services';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: storeId } = await params;

  const result = await inventoryService.getStoreTradeMatches(storeId, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, matches: result.data },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
