// app/api/decks/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateTalisharRequest } from '@/lib/middleware/talishar-auth';
import { userService, deckService } from '@/lib/services';
import type { DeckFormat, DeckListFilters } from '@/lib/services/contracts/IDeckService';

/**
 * GET /api/decks/list?metafy_id=<uuid>
 *
 * Returns a list of public decks for a FaB Bazaar user identified by their Metafy ID.
 * Intended for Talishar integration — requires Talishar API key.
 *
 * Query params:
 *   metafy_id  (required) - Metafy user UUID
 *   format     (optional) - filter by deck format
 *   limit      (optional) - default 50
 *   offset     (optional) - default 0
 */
export async function GET(request: NextRequest) {
  try {
    const validation = await validateTalisharRequest(request);
    if (!validation.valid) {
      return validation.response;
    }

    const url = new URL(request.url);
    const metafyId = url.searchParams.get('metafy_id');

    if (!metafyId) {
      return NextResponse.json(
        { success: false, error: 'metafy_id query parameter is required' },
        { status: 400 }
      );
    }

    // Look up user by Metafy ID
    const userResult = await userService.findByMetafyId(metafyId);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { success: false, error: 'No FaB Bazaar user found for that Metafy ID' },
        { status: 404 }
      );
    }

    const userId = userResult.data.id;

    // Parse optional filters
    const format = url.searchParams.get('format') as DeckFormat | null;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const filters: DeckListFilters = { availableOnTalishar: true };
    if (format) filters.format = format;

    const result = await deckService.listUserDecks(
      userId,
      filters,
      { limit, skip: offset, sort: { updatedAt: -1 } }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const { decks, total } = result.data;

    return NextResponse.json({
      success: true,
      decks: decks.map(deck => {
        // Extract hero collector number for Talishar (e.g. "HVY047", "EVO004")
        const heroCardId = deck.hero?.[0]?.printingDetails?.collector_number || '';

        return {
          publicId: deck.publicId,
          name: deck.name,
          format: deck.format,
          heroName: deck.heroName,
          heroCardId,
          slug: deck.slug,
          totalCards: deck.totalCards,
          updatedAt: deck.updatedAt,
          talisharUrl: `/api/decks/${deck.publicId}/talishar`,
        };
      }),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error('[DeckList] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
