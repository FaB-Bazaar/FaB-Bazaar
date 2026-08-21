/**
 * GET /api/daily
 *
 * Returns the authenticated user's daily movers — printings in their inventory
 * that appeared in the pipeline-computed `daily_movers` table for the latest
 * (or specified via ?asOf=YYYY-MM-DD) snapshot date.
 *
 * ?scope=market returns the site-wide market view instead (all movers,
 * no inventory context). Market data is not user-specific — no auth required.
 *
 * Auth: session required (default scope only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { dailyMoversService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get('asOf') ?? undefined;

    if (searchParams.get('scope') === 'market') {
      const market = await dailyMoversService.getMarketMovers(asOf);
      if (!market.success) {
        return NextResponse.json({ success: false, error: market.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: market.data });
    }

    const authResult = await authenticateSession();
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Not authenticated' },
        { status: 401 },
      );
    }

    const result = await dailyMoversService.getMoversInUserCollection(
      authResult.userId,
      asOf,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
