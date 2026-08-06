import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, printingsService, inventoryService } from '@/lib/services';
import { computePimpUpgrades, type PimpPrinting } from '@/lib/deck/pimp-upgrades';
import type { DeckPrintingDTO } from '@/lib/services/contracts/IDeckService';

/**
 * GET /api/decks/[deckId]/pimp — "Pimp My Deck".
 *
 * For every card in the deck (hero, equipment, maindeck, inventory, bench),
 * lists the blingier ENGLISH printings — extended/alt art, marvel, cold foil,
 * promo, alpha/first edition — that the CALLER does not own anywhere in their
 * collection and that outrank their best owned copy. The comparison is against
 * the viewer's collection, so any visible deck works, not just your own.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const { deckId } = await params;
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Owner-scoped lookup first, then the public/unlisted fallback (same
    // two-step as GET /api/decks/[deckId]); a private deck surviving only the
    // fallback belongs to someone else — treat as not found.
    let deckResult = await deckService.findByPublicId(deckId, authResult.userId);
    if (deckResult.success && !deckResult.data) {
      deckResult = await deckService.findByPublicId(deckId);
    }
    if (!deckResult.success || !deckResult.data || deckResult.data.visibility === 'private') {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }
    const deck = deckResult.data;

    // Distinct cards across the whole deck box, quantities merged (the same
    // card can appear as several printings and in several categories).
    const merged = new Map<string, { cardUniqueId: string; name: string; quantity: number }>();
    const categories: DeckPrintingDTO[][] = [
      deck.hero, deck.equipment, deck.maindeck, deck.inventory, deck.benched ?? [],
    ];
    for (const row of categories.flat()) {
      const cardUniqueId = row.printingDetails?.card_unique_id;
      if (!cardUniqueId) continue;
      const existing = merged.get(cardUniqueId);
      const qty = row.quantity ?? 1;
      if (existing) existing.quantity += qty;
      else merged.set(cardUniqueId, {
        cardUniqueId,
        name: row.printingDetails?.display_name || row.printingDetails?.name || 'Unknown card',
        quantity: qty,
      });
    }
    const deckCards = [...merged.values()];

    // English only: bling shopping runs on TCGplayer prices, which only
    // English printings carry.
    const searchResult = await printingsService.searchPrintings(
      { cardUniqueIds: deckCards.map((c) => c.cardUniqueId), languages: ['en'] },
      { limit: 5000 },
    );
    if (!searchResult.success) {
      return NextResponse.json({ success: false, error: searchResult.error }, { status: 500 });
    }
    const printings = searchResult.data.printings as unknown as PimpPrinting[];

    const ownedResult = await inventoryService.getOwnedCountsByPrintingId(
      authResult.userId,
      printings.map((p) => p.printing_id),
    );
    if (!ownedResult.success) {
      return NextResponse.json({ success: false, error: ownedResult.error }, { status: 500 });
    }

    const result = computePimpUpgrades(deckCards, printings, ownedResult.data);
    return NextResponse.json({
      success: true,
      data: { deckName: deck.name, deckPublicId: deck.publicId, ...result },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
