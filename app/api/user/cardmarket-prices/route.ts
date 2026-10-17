// POST /api/user/cardmarket-prices — account-wide choice to see Cardmarket €
// instead of TCGplayer $ everywhere (users.cardmarket_prices, migration 0126).
// Body: { enabled: boolean }.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const enabled = (body as { enabled?: unknown })?.enabled;
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'enabled must be true or false' }, { status: 400 });
  }

  const result = await userService.updateProfile(session.user.id, { cardmarketPrices: enabled });
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
