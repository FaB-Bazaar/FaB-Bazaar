import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { db } from '@/lib/postgres/db';
import { decks, deckCards, printings, cards, inventoryItems } from '@/lib/postgres/schema';
import { eq, and, sql, inArray, or } from 'drizzle-orm';
import { deckService } from '@/lib/services';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

/**
 * GET /api/decks/[deckId]/upgrade-printings
 *
 * Returns a list of swap suggestions: for each unowned printing in the deck,
 * find the best-owned alternative printing of the same card (highest tcg_low).
 * Hero cards are excluded — those should be swapped manually.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const userId = authResult.userId!;

    // Resolve deck by publicId or internal id
    const deckRow = await db
      .select({ id: decks.id })
      .from(decks)
      .where(or(eq(decks.id, deckId), eq(decks.publicId, deckId)))
      .limit(1);

    if (!deckRow.length) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }
    const internalDeckId = deckRow[0].id;

    // Get all non-hero deck cards with card_unique_id and current tcg_low
    const deckCardRows = await db
      .select({
        printingId: deckCards.printingId,
        category: deckCards.category,
        quantity: deckCards.quantity,
        cardUniqueId: printings.cardUniqueId,
        tcgLow: printings.tcgLow,
        cardName: sql<string>`COALESCE(${cards.displayName}, ${cards.name}, ${deckCards.printingId})`,
      })
      .from(deckCards)
      .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
      .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(eq(deckCards.deckId, internalDeckId));

    const nonHeroRows = deckCardRows.filter(r => r.category !== 'hero');
    if (!nonHeroRows.length) {
      return NextResponse.json({ success: true, data: { swaps: [] } });
    }

    // Check how many of each printing the user currently owns
    const deckPrintingIds = nonHeroRows.map(r => r.printingId);
    const ownedRows = await db
      .select({
        printingId: inventoryItems.printingId,
        owned: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
      })
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.userId, userId),
        inArray(inventoryItems.printingId, deckPrintingIds)
      ))
      .groupBy(inventoryItems.printingId);

    const ownedMap = new Map(ownedRows.map(r => [r.printingId, r.owned]));

    // Only keep printings the user doesn't fully own
    const unownedRows = nonHeroRows.filter(r => {
      const owned = ownedMap.get(r.printingId) ?? 0;
      return owned < (r.quantity ?? 1);
    });

    if (!unownedRows.length) {
      return NextResponse.json({ success: true, data: { swaps: [] } });
    }

    const unownedCardUniqueIds = [
      ...new Set(unownedRows.map(r => r.cardUniqueId).filter(Boolean) as string[]),
    ];

    // Find all printings of those cards the user owns, ordered by tcg_low desc
    const altRows = await db
      .select({
        printingId: inventoryItems.printingId,
        cardUniqueId: printings.cardUniqueId,
        tcgLow: printings.tcgLow,
        ownedQty: sql<number>`SUM(${inventoryItems.quantity})::int`,
      })
      .from(inventoryItems)
      .leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
      .where(and(
        eq(inventoryItems.userId, userId),
        inArray(printings.cardUniqueId, unownedCardUniqueIds)
      ))
      .groupBy(inventoryItems.printingId, printings.cardUniqueId, printings.tcgLow)
      .having(sql`SUM(${inventoryItems.quantity}) > 0`);

    // For each card, pick the owned printing with the highest tcg_low
    const bestAlt = new Map<string, { printingId: string; tcgLow: number | null }>();
    for (const alt of altRows) {
      if (!alt.cardUniqueId) continue;
      const current = bestAlt.get(alt.cardUniqueId);
      if (!current || (alt.tcgLow ?? 0) > (current.tcgLow ?? 0)) {
        bestAlt.set(alt.cardUniqueId, { printingId: alt.printingId, tcgLow: alt.tcgLow });
      }
    }

    // Build swap list — skip if the best owned printing is already the deck printing
    const swaps: Array<{
      currentPrintingId: string;
      newPrintingId: string;
      cardName: string;
      category: string;
      currentTcgLow: number | null;
      newTcgLow: number | null;
    }> = [];

    for (const row of unownedRows) {
      if (!row.cardUniqueId) continue;
      const best = bestAlt.get(row.cardUniqueId);
      if (!best || best.printingId === row.printingId) continue;
      swaps.push({
        currentPrintingId: row.printingId,
        newPrintingId: best.printingId,
        cardName: row.cardName,
        category: row.category,
        currentTcgLow: row.tcgLow,
        newTcgLow: best.tcgLow,
      });
    }

    return NextResponse.json({ success: true, data: { swaps } });
  } catch (error) {
    console.error('[UpgradePrintings] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to find upgrade suggestions' }, { status: 500 });
  }
}

/**
 * POST /api/decks/[deckId]/upgrade-printings
 *
 * Body: { swaps: [{ currentPrintingId, newPrintingId, category }] }
 * Executes the swap list returned by GET.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const swaps: Array<{ currentPrintingId: string; newPrintingId: string; category: string }> =
      body.swaps ?? [];

    if (!swaps.length) {
      return NextResponse.json({ success: true, data: { swapped: 0, errors: [] } });
    }

    let swapped = 0;
    const errors: string[] = [];
    for (const swap of swaps) {
      const result = await deckService.swapPrinting(
        deckId,
        authResult.userId!,
        swap.currentPrintingId,
        swap.newPrintingId,
        swap.category as DeckCategory
      );
      if (result.success) swapped++;
      else errors.push(result.error ?? 'Unknown error');
    }

    return NextResponse.json({ success: true, data: { swapped, errors } });
  } catch (error) {
    console.error('[UpgradePrintings] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to execute upgrades' }, { status: 500 });
  }
}
