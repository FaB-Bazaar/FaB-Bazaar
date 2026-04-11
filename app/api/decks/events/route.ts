// app/api/decks/events/route.ts - Get distinct events for featured decks in a month
import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const month = parseInt(url.searchParams.get('month') || '', 10);
    const year = parseInt(url.searchParams.get('year') || '', 10);

    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: 'month and year are required' },
        { status: 400 }
      );
    }

    const result = await deckService.getEventSummaries(year, month);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true, data: result.data });
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=120'
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
