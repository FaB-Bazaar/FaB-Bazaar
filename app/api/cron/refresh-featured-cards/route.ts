import { NextRequest, NextResponse } from 'next/server';
import { refreshFeaturedPrintingIds } from '@/lib/featured-cards-refresh';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const printingIds = await refreshFeaturedPrintingIds();

    return NextResponse.json({
      success: true,
      cardsRefreshed: printingIds.length,
    });
  } catch (error) {
    console.error('Featured cards cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
