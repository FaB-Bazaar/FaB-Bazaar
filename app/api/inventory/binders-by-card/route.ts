import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { inventoryService } from '@/lib/services';

/**
 * POST /api/inventory/binders-by-card
 * Body: { cardUniqueIds: string[] }  (max 100)
 *
 * Which of the caller's binders hold any printing of each card, with the
 * summed quantity per binder. Used by the deck-editor card-details lightbox
 * ("In your binders: Main ×2 · Trades ×1").
 */
const MAX_IDS = 100;

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error ?? 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { cardUniqueIds } = (body ?? {}) as { cardUniqueIds?: unknown };
  if (!Array.isArray(cardUniqueIds)) {
    return NextResponse.json({ error: 'cardUniqueIds (array) is required' }, { status: 400 });
  }
  if (cardUniqueIds.length > MAX_IDS) {
    return NextResponse.json({ error: `cardUniqueIds exceeds max of ${MAX_IDS}` }, { status: 400 });
  }
  if (!cardUniqueIds.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: 'cardUniqueIds must be strings' }, { status: 400 });
  }

  const result = await inventoryService.getBindersByCardUniqueId(authResult.userId!, cardUniqueIds);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
