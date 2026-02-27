// app/api/decks/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckFormat } from '@/lib/services/contracts/IDeckService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Authentication
    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });

    if (!authResult.success) {
      console.log(`[DeckList] Authentication failed: ${authResult.error}`);
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
        hint: 'Provide either a valid session (web), discordId, or mcp_token parameter'
      }, { status: 401 });
    }

    console.log(`[DeckList] Authenticated user: ${authResult.username} via ${authResult.authMethod}`);

    // Parse query parameters for filtering/sorting
    const format = url.searchParams.get('format') as DeckFormat | null;
    const isPublicParam = url.searchParams.get('isPublic');
    const sortBy = url.searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build filters
    const filters: { format?: DeckFormat; isPublic?: boolean } = {};
    if (format) filters.format = format;
    if (isPublicParam !== null) filters.isPublic = isPublicParam === 'true';

    // Build pagination/sort options
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Use service layer to fetch decks
    const result = await deckService.listUserDecks(
      authResult.userId!,
      filters,
      { limit, skip: offset, sort }
    );

    if (!result.success) {
      console.error('[DeckList] Error fetching decks:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    const { decks, total } = result.data;

    // Calculate collection summary
    const publicCount = decks.filter(d => d.isPublic).length;
    const totalCards = decks.reduce((sum, deck) => sum + (deck.totalCards || 0), 0);
    const totalValue = decks.reduce((sum, deck) => sum + (deck.estimatedValue || 0), 0);
    const formats = [...new Set(decks.map(deck => deck.format))];

    const collectionSummary = {
      totalDecks: total,
      publicDecks: publicCount,
      totalCards,
      totalValue,
      formats,
    };

    console.log(`[DeckList] Retrieved ${decks.length} decks for user ${authResult.username}`);

    return NextResponse.json({
      success: true,
      decks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      summary: collectionSummary,
      authMethod: authResult.authMethod,
      authenticatedUser: authResult.username,
      message: `Retrieved ${decks.length} decks via ${authResult.authMethod} authentication`
    });

  } catch (error) {
    console.error('[DeckList] Error fetching decks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
