import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, printingsService } from '@/lib/services';
import { cheapestByFinish } from '@/lib/deck/deck-prices';
import type { DeckPrintingDTO } from '@/lib/services/contracts/IDeckService';

/**
 * GET /api/decks/[deckId]/printing-prices — the Prices view's "Compare
 * printings" columns: for every card in the deck (bench excluded, like the
 * view's totals), the cheapest English tcg_low per finish plus overall.
 * Any viewer of a public/unlisted deck; a private deck only for its owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const { deckId } = await params;
    const authResult = await authenticateRequest(request, {});
    const userId = authResult.success ? authResult.userId : undefined;

    // Owner-scoped lookup first (finds the caller's private deck), then the
    // public/unlisted fallback, where a private deck belongs to someone else.
    let deckResult = userId ? await deckService.findByPublicId(deckId, userId) : null;
    if (!deckResult?.success || !deckResult.data) {
      deckResult = await deckService.findByPublicId(deckId);
      if (deckResult.success && deckResult.data?.visibility === 'private') {
        return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
      }
    }
    if (!deckResult.success || !deckResult.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }
    const deck = deckResult.data;

    const zones: DeckPrintingDTO[][] = [deck.hero, deck.equipment, deck.maindeck, deck.inventory, deck.tokens ?? []];
    const cardUniqueIds = [...new Set(
      zones.flat().map((c) => c.printingDetails?.card_unique_id).filter((id): id is string => !!id),
    )];
    if (cardUniqueIds.length === 0) {
      return NextResponse.json({ success: true, data: { byCard: {} } });
    }

    // English only: TCGplayer prices are carried by the English printings.
    const searchResult = await printingsService.searchPrintings(
      { cardUniqueIds, languages: ['en'] },
      { limit: 5000 },
    );
    if (!searchResult.success) {
      return NextResponse.json({ success: false, error: searchResult.error }, { status: 500 });
    }
    const printings = searchResult.data.printings as unknown as Array<{ card_unique_id: string; foiling: string | null; tcg_low: number | null }>;

    return NextResponse.json({ success: true, data: { byCard: cheapestByFinish(printings) } });
  } catch (error) {
    console.error('[GET /api/decks/[deckId]/printing-prices]', error);
    return NextResponse.json({ success: false, error: 'Failed to load printing prices' }, { status: 500 });
  }
}
