import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

// Private notes for a deck. Owner/co-owner only — never shown publicly (the deck
// GET strips metadata.gamePlan / metadata.cardNotes for non-owners). Stored in
// deck.metadata so no migration is needed (matchups already live there):
//   metadata.gamePlan   — free-text deck game plan (string)
//   metadata.cardNotes  — one short note per unique card, keyed by `${name}|${pitch}`

const MAX_NOTES = 10_000;
const MAX_CARD_NOTE = 280;
const MAX_CARD_ENTRIES = 400;

type OwnedDeck =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; deck: { metadata?: Record<string, any> | null } };

async function ownedDeck(request: NextRequest, publicId: string): Promise<OwnedDeck> {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success) {
    return { ok: false, response: NextResponse.json({ success: false, error: authResult.error }, { status: 401 }) };
  }
  // findByPublicId(publicId, userId) returns the deck only when the caller is
  // the owner or a co-owner, so a null result == not found OR not authorized.
  const lookup = await deckService.findByPublicId(publicId, authResult.userId);
  if (!lookup.success || !lookup.data) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 }) };
  }
  return { ok: true, userId: authResult.userId as string, deck: lookup.data };
}

// Keep only string values, trim, drop empties, cap length and count.
function sanitizeCardNotes(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [key, val] of Object.entries(input)) {
    if (n >= MAX_CARD_ENTRIES) break;
    if (typeof val !== 'string') continue;
    const trimmed = val.trim().slice(0, MAX_CARD_NOTE);
    if (!trimmed) continue;
    out[key] = trimmed;
    n++;
  }
  return out;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ deckId: string }> }): Promise<NextResponse> {
  try {
    const { deckId: publicId } = await params;
    const res = await ownedDeck(request, publicId);
    if (!res.ok) return res.response;
    const meta = res.deck.metadata ?? {};
    const notes = typeof meta.gamePlan === 'string' ? meta.gamePlan : '';
    const cardNotes = meta.cardNotes && typeof meta.cardNotes === 'object' ? meta.cardNotes : {};
    return NextResponse.json({ success: true, data: { notes, cardNotes } });
  } catch (error) {
    console.error('[Deck Notes] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ deckId: string }> }): Promise<NextResponse> {
  try {
    const { deckId: publicId } = await params;
    const body = await request.json().catch(() => null);
    const notes = body?.notes;
    const cardNotes = body?.cardNotes;

    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json({ success: false, error: 'notes must be a string' }, { status: 400 });
    }
    if (typeof notes === 'string' && notes.length > MAX_NOTES) {
      return NextResponse.json({ success: false, error: `notes must be ${MAX_NOTES} characters or fewer` }, { status: 400 });
    }
    if (cardNotes !== undefined && (typeof cardNotes !== 'object' || cardNotes === null || Array.isArray(cardNotes))) {
      return NextResponse.json({ success: false, error: 'cardNotes must be an object map' }, { status: 400 });
    }
    if (notes === undefined && cardNotes === undefined) {
      return NextResponse.json({ success: false, error: 'Provide notes and/or cardNotes' }, { status: 400 });
    }

    const res = await ownedDeck(request, publicId);
    if (!res.ok) return res.response;

    // Read-modify-write so we don't clobber other metadata keys (e.g. matchups).
    const metadata: Record<string, any> = { ...(res.deck.metadata || {}) };
    if (notes !== undefined) metadata.gamePlan = notes;
    if (cardNotes !== undefined) metadata.cardNotes = sanitizeCardNotes(cardNotes as Record<string, unknown>);

    const update = await deckService.updateDeck(publicId, res.userId, { metadata });
    if (!update.success) {
      return NextResponse.json({ success: false, error: update.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      data: { notes: metadata.gamePlan ?? '', cardNotes: metadata.cardNotes ?? {} },
    });
  } catch (error) {
    console.error('[Deck Notes] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
