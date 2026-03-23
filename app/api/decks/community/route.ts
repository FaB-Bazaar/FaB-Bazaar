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
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    const filters = {
      ...(format && { format }),
      ...(heroName && { heroName }),
      ...(search && { search }),
      ...(username && { username }),
      ...(featured !== null && { featured: featured === 'true' }),
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
