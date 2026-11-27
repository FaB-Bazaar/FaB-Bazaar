// /api/decks/[deckId]/partner-shares — which connected apps get this deck
// (deck Settings → "Send to"). Partner game clients such as Cintari see only
// the decks sent to them, through /api/partner/v1/play.
//
// GET: the signed-in editor's connected apps that can receive decks, each
//      with whether this deck is sent to it.
// PUT { client_id, shared }: send the deck to one app, or stop.
//
// Session only, like Profile → Connected accounts: an app must never be able
// to send itself decks.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deckService, oauthService } from '@/lib/services';
import { appsThatCanPlay } from '@/lib/deck/partner-shares';
import { DECK_VERSION_NOT_EDITABLE } from '@/lib/deck/deck-versions';

type Context = { params: Promise<{ deckId: string }> };

function failure(error: string) {
  if (error === DECK_VERSION_NOT_EDITABLE) return NextResponse.json({ error }, { status: 403 });
  return NextResponse.json({ error: 'Could not load the apps for this deck' }, { status: 500 });
}

async function connectedPlayApps(userId: string) {
  const apps = await oauthService.listAuthorizedApps(userId);
  return apps.success ? appsThatCanPlay(apps.data) : null;
}

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deckId } = await params;

  const shares = await deckService.listDeckPartnerShares(deckId, session.user.id);
  if (!shares.success) return failure(shares.error);
  const apps = await connectedPlayApps(session.user.id);
  if (!apps) return failure('apps');

  const sent = new Set(shares.data);
  return NextResponse.json({ success: true, data: apps.map(app => ({ ...app, shared: sent.has(app.client_id) })) });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deckId } = await params;

  const body = await request.json().catch(() => null) as { client_id?: unknown; shared?: unknown } | null;
  if (!body || typeof body.client_id !== 'string' || !body.client_id || typeof body.shared !== 'boolean') {
    return NextResponse.json({ error: 'Send { client_id, shared }' }, { status: 400 });
  }
  const { client_id: clientId, shared } = body;

  // Turning ON needs an app this user connected with deck access. Turning off
  // is always allowed, even for an app since disconnected.
  if (shared) {
    const apps = await connectedPlayApps(session.user.id);
    if (!apps) return failure('apps');
    if (!apps.some(app => app.client_id === clientId)) {
      return NextResponse.json({ error: 'Connect that app with access to your decks first' }, { status: 400 });
    }
  }

  const result = await deckService.setDeckPartnerShare(deckId, session.user.id, clientId, shared);
  if (!result.success) return failure(result.error);
  return NextResponse.json({ success: true, data: { client_id: clientId, shared: result.data.shared } });
}
