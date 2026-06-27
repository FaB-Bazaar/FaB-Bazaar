import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

// Private notes for a deck. Owner/co-owner only — never shown publicly (the deck
// GET strips these from metadata for non-owners). Stored in deck.metadata so no
// migration is needed (matchups already live there):
//   metadata.gamePlan      — free-text deck game plan (string)
//   metadata.cardNotes     — one short note per unique card, keyed by `${name}|${pitch}`
//   metadata.matchupNotes  — context per opponent hero, keyed by the Talishar hero slug

const MAX_NOTES = 10_000;
const MAX_CARD_NOTE = 280;
const MAX_MATCHUP_NOTE = 2_000;
const MAX_MAP_ENTRIES = 400;

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
function sanitizeNoteMap(input: Record<string, unknown>, maxLen: number): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [key, val] of Object.entries(input)) {
    if (n >= MAX_MAP_ENTRIES) break;
    if (typeof val !== 'string') continue;
    const trimmed = val.trim().slice(0, maxLen);
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
    const matchupNotes = meta.matchupNotes && typeof meta.matchupNotes === 'object' ? meta.matchupNotes : {};
    return NextResponse.json({ success: true, data: { notes, cardNotes, matchupNotes } });
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
    const matchupNotes = body?.matchupNotes;
    const isMap = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json({ success: false, error: 'notes must be a string' }, { status: 400 });
    }
    if (typeof notes === 'string' && notes.length > MAX_NOTES) {
      return NextResponse.json({ success: false, error: `notes must be ${MAX_NOTES} characters or fewer` }, { status: 400 });
    }
    if (cardNotes !== undefined && !isMap(cardNotes)) {
      return NextResponse.json({ success: false, error: 'cardNotes must be an object map' }, { status: 400 });
    }
    if (matchupNotes !== undefined && !isMap(matchupNotes)) {
      return NextResponse.json({ success: false, error: 'matchupNotes must be an object map' }, { status: 400 });
    }
    if (notes === undefined && cardNotes === undefined && matchupNotes === undefined) {
      return NextResponse.json({ success: false, error: 'Provide notes, cardNotes, and/or matchupNotes' }, { status: 400 });
    }

    const res = await ownedDeck(request, publicId);
    if (!res.ok) return res.response;

    // Read-modify-write so we don't clobber other metadata keys (e.g. matchups).
    const metadata: Record<string, any> = { ...(res.deck.metadata || {}) };
    if (notes !== undefined) metadata.gamePlan = notes;
    if (cardNotes !== undefined) metadata.cardNotes = sanitizeNoteMap(cardNotes as Record<string, unknown>, MAX_CARD_NOTE);
    if (matchupNotes !== undefined) metadata.matchupNotes = sanitizeNoteMap(matchupNotes as Record<string, unknown>, MAX_MATCHUP_NOTE);

    const update = await deckService.updateDeck(publicId, res.userId, { metadata });
    if (!update.success) {
      return NextResponse.json({ success: false, error: update.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      data: { notes: metadata.gamePlan ?? '', cardNotes: metadata.cardNotes ?? {}, matchupNotes: metadata.matchupNotes ?? {} },
    });
  } catch (error) {
    console.error('[Deck Notes] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
