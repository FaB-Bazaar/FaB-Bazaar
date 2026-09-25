import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { marketFeedService } from '@/lib/services';
import { marketFeedToday } from '@/lib/market-feed/feed-date';
import { isValidFeedDate } from '@/lib/services/postgres/market-feed/PostgresMarketFeedService';
import { isFeedRegion } from '@/lib/market-feed/region';

/**
 * GET /api/feed?date=YYYY-MM-DD&region=na|eu|apac — public: one day of one
 * regional feed (default today US Eastern, region na) plus the dates that have
 * listings in that region.
 * POST — superadmin (OAuth bearers allowed, for Meta Muse via MCP): replace one
 * day of one region. Body `{ feedDate?, region?, listings[] }`; feedDate
 * defaults to today, region to 'na'.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? marketFeedToday();
  if (!isValidFeedDate(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const region = request.nextUrl.searchParams.get('region') ?? 'na';
  if (!isFeedRegion(region)) {
    return NextResponse.json({ error: "region must be 'na', 'eu' or 'apac'" }, { status: 400 });
  }

  const [day, dates] = await Promise.all([marketFeedService.getDay(date, region), marketFeedService.listDates(60, region)]);
  if (!day.success) return NextResponse.json({ error: day.error }, { status: 500 });
  if (!dates.success) return NextResponse.json({ error: dates.error }, { status: 500 });

  return NextResponse.json({ success: true, data: { ...day.data, dates: dates.data } });
}

export async function POST(request: NextRequest) {
  let body: { feedDate?: string; region?: string; listings?: unknown } = {};
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
  const region = body.region ?? 'na';
  if (!isFeedRegion(region)) {
    return NextResponse.json({ error: "region must be 'na', 'eu' or 'apac'" }, { status: 400 });
  }

  const result = await marketFeedService.replaceDay({
    feedDate: body.feedDate ?? marketFeedToday(),
    region,
    listings: body.listings,
    createdBy: gate.userId,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
