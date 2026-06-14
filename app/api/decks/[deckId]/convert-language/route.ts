import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

/**
 * GET /api/decks/[deckId]/convert-language?language=fr
 *
 * Preview: plans (does not apply) the exact-variant swaps to convert the deck's
 * printings to the target language. Cards with no same-variant printing in that
 * language are returned in `skipped`.
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

  const language = new URL(request.url).searchParams.get('language') || 'en';
  const result = await deckService.convertDeckToLanguage(deckId, authResult.userId!, language);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

/**
 * POST /api/decks/[deckId]/convert-language
 *
 * Body: { targetLanguage: 'fr' }
 * Re-plans server-side (authoritative) and applies the swaps. Ownership is
 * enforced by applyPrintingUpgrades.
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
  const targetLanguage = String(body.targetLanguage || 'en');

  const plan = await deckService.convertDeckToLanguage(deckId, authResult.userId!, targetLanguage);
  if (!plan.success) {
    return NextResponse.json({ success: false, error: plan.error }, { status: 500 });
  }

  const result = await deckService.applyPrintingUpgrades(deckId, authResult.userId!, plan.data.swaps);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: { swapped: result.data.swapped, skipped: plan.data.skipped.length, errors: result.data.errors },
  });
}
