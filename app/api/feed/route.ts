import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { marketFeedService } from '@/lib/services';
import { marketFeedToday } from '@/lib/market-feed/feed-date';
import { isValidFeedDate } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';

/**
 * GET /api/feed?date=YYYY-MM-DD — public: one day of the anonymous market
 * feed (default today, US Eastern) plus the dates that have listings.
 * POST — superadmin (OAuth bearers allowed, for Meta Muse via MCP): replace a
 * whole day. Body `{ feedDate?, listings[] }`; feedDate defaults to today.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? marketFeedToday();
  if (!isValidFeedDate(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const [day, dates] = await Promise.all([marketFeedService.getDay(date), marketFeedService.listDates()]);
  if (!day.success) return NextResponse.json({ error: day.error }, { status: 500 });
  if (!dates.success) return NextResponse.json({ error: dates.error }, { status: 500 });

  return NextResponse.json({ success: true, data: { ...day.data, dates: dates.data } });
}

export async function POST(request: NextRequest) {
  let body: { feedDate?: string; listings?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  if (!Array.isArray(body.listings)) {
    return NextResponse.json({ error: 'listings must be an array' }, { status: 400 });
  }

  const result = await marketFeedService.replaceDay({
    feedDate: body.feedDate ?? marketFeedToday(),
    listings: body.listings,
    createdBy: gate.userId,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
