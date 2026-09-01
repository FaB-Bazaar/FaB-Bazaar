// app/api/decks/community/route.ts - Public deck listing (no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';
import type { DeckFormat } from '@/lib/services/contracts/IDeckService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    const format = url.searchParams.get('format') as DeckFormat | null;
    const heroName = url.searchParams.get('heroName');
    const search = url.searchParams.get('search');
    const username = url.searchParams.get('username');
    const featured = url.searchParams.get('featured');
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    const eventName = url.searchParams.get('eventName');
    // Allowlisted so an arbitrary string never reaches the ORDER BY branch.
    const sortByParam = url.searchParams.get('sortBy');
    const sortBy: 'placing' | 'recent' | undefined =
      sortByParam === 'placing' || sortByParam === 'recent' ? sortByParam : undefined;

    // Rolling event_date window (ISO YYYY-MM-DD); malformed values are dropped.
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    const filters = {
      ...(format && { format }),
      ...(heroName && { heroName }),
      ...(search && { search }),
      ...(username && { username }),
      ...(featured !== null && { featured: featured === 'true' }),
      ...(monthParam && yearParam && {
        month: parseInt(monthParam, 10),
        year: parseInt(yearParam, 10),
      }),
      ...(eventName && { eventName }),
      ...(sortBy && { sortBy }),
      ...(dateFrom && ISO_DATE.test(dateFrom) && { dateFrom }),
      ...(dateTo && ISO_DATE.test(dateTo) && { dateTo }),
    };

    const result = await deckService.listPublicDecks(filters, {
      limit,
      skip: (page - 1) * limit,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: {
        decks: result.data.decks,
        total: result.data.total,
        pagination: {
          page,
          limit,
          total: result.data.total,
          hasMore: page * limit < result.data.total,
        },
      },
    });

    response.headers.set(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=120'
    );

    return response;
  } catch (error) {
    console.error('[CommunityDecks] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
