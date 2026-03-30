// app/api/collection/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';

/**
 * POST /api/collection/transfer
 *
 * Cross-source bulk transfer: accepts cards from multiple source binders in a single request.
 * Groups cards by sourceBinderId and runs one transfer per group to the shared target.
 * The service merges quantities when the same printing already exists in the target binder.
 *
 * Body: {
 *   targetBinderId: string,
 *   cards: Array<{ cardId: string; sourceBinderId: string; quantity: number }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    const userId = authResult.userId;

    const body = await request.json();
    const { targetBinderId, cards } = body;

    if (!targetBinderId || typeof targetBinderId !== 'string') {
      return NextResponse.json({ error: 'Missing targetBinderId' }, { status: 400 });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'Missing or empty cards array' }, { status: 400 });
    }

    for (const card of cards) {
      if (!card.cardId || !card.sourceBinderId || typeof card.quantity !== 'number' || card.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each card must have cardId, sourceBinderId, and quantity > 0' },
          { status: 400 }
        );
      }
      if (card.sourceBinderId === targetBinderId) {
        return NextResponse.json(
          { error: 'Source and target binders cannot be the same' },
          { status: 400 }
        );
      }
    }

    // Group cards by sourceBinderId
    const bySource = new Map<string, { cardId: string; quantity: number }[]>();
    for (const card of cards) {
      const group = bySource.get(card.sourceBinderId) ?? [];
      group.push({ cardId: card.cardId, quantity: card.quantity });
      bySource.set(card.sourceBinderId, group);
    }

    // Run one transfer per source binder (concurrent — different sources, same target)
    const groupResults = await Promise.all(
      [...bySource.entries()].map(([sourceBinderId, groupCards]) =>
        binderService.transferSelectedCards(sourceBinderId, targetBinderId, userId, groupCards)
      )
    );

    // Aggregate results
    const allResults: any[] = [];
    const summary = {
      successful: 0,
      failed: 0,
      fullyTransferred: 0,
      partiallyTransferred: 0,
      mergedInTarget: 0,
      totalQuantityTransferred: 0,
    };

    for (const result of groupResults) {
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      const d = result.data;
      allResults.push(...d.results);
      summary.successful += d.summary.successful;
      summary.failed += d.summary.failed;
      summary.fullyTransferred += d.summary.fullyTransferred;
      summary.partiallyTransferred += d.summary.partiallyTransferred;
      summary.mergedInTarget += d.summary.mergedInTarget;
      summary.totalQuantityTransferred += d.summary.totalQuantityTransferred;
    }

    return NextResponse.json({
      success: true,
      summary,
      results: allResults,
    });
  } catch (error) {
    console.error('[Collection Transfer] Error:', error);
    return NextResponse.json({ error: 'Failed to transfer cards' }, { status: 500 });
  }
}
