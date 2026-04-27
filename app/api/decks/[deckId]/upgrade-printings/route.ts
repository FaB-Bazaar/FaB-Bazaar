import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

/**
 * GET /api/decks/[deckId]/upgrade-printings
 *
 * Returns upgrade suggestions for the deck. For each unowned non-hero deck
 * printing, lists every owned alternative printing of the same card; the
 * highest-`tcgLow` alternative is flagged as recommended. Heroes are excluded.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const result = await deckService.getUpgradePrintingSuggestions(deckId, authResult.userId!);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { suggestions: result.data } });
}

/**
 * POST /api/decks/[deckId]/upgrade-printings
 *
 * Body: { swaps: [{ currentPrintingId, newPrintingId, category }] }
 * Executes a (possibly user-edited) subset of the GET suggestions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const swaps: Array<{ currentPrintingId: string; newPrintingId: string; category: DeckCategory }> =
    body.swaps ?? [];

  const result = await deckService.applyPrintingUpgrades(deckId, authResult.userId!, swaps);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
