// app/api/decks/import/fabrary/route.ts
//
// POST /api/decks/import/fabrary — create a deck from a pasted FaBrary list.
// Thin HTTP wrapper: auth + validation + shape. All resolution/creation logic
// lives in lib/deck/import-fabrary (dependency-injected, unit-tested there).
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { importFabraryDeck } from '@/lib/deck/import-fabrary';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 },
      );
    }

    const { text } = body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Decklist text is required' },
        { status: 400 },
      );
    }

    // Lazy service import — avoids the circular-dep TDZ trap (root CLAUDE.md).
    const { deckService, printingsService, bannedCardsService } = await import('@/lib/services');

    const result = await importFabraryDeck(
      { userId: authResult.userId!, text },
      {
        createDeck: (userId, dto) => deckService.createDeck(userId, dto),
        addPrintings: (publicId, userId, printings) =>
          deckService.addPrintings(publicId, userId, printings as any),
        // Unwrap PrintingsSearchResult → the printings array the orchestrator expects.
        searchPrintings: async (filters, options) => {
          const r = await printingsService.searchPrintings(filters, options);
          return r.success ? { success: true, data: r.data.printings } : r;
        },
        bulkResolveByName: (cards) => printingsService.bulkResolveByName(cards),
        listExcludedHeroes: (registryFormat) =>
          bannedCardsService.listExcludedHeroes(registryFormat as any),
      },
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[FabraryImport] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to import deck from FaBrary list' },
      { status: 500 },
    );
  }
}
