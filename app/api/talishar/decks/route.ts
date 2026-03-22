// GET /api/talishar/decks?metafyId=xxx&metafyHash=xxx&timestamp=xxx
// Called by Talishar's backend to fetch a user's Talishar-enabled decks by Metafy ID.
// Auth: hash validation (new) or API key (legacy fallback)
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateTalisharRequest } from '@/lib/middleware/talishar-auth';
import { userService, deckService } from '@/lib/services';

const HASH_MAX_AGE_SECS = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metafyId = searchParams.get('metafyId');
  const metafyHash = searchParams.get('metafyHash');
  const timestamp = searchParams.get('timestamp');

  if (!metafyId) {
    return NextResponse.json(
      { success: false, error: 'metafyId query parameter is required' },
      { status: 400 }
    );
  }

  if (metafyHash && timestamp) {
    const salt = process.env.FABBAZAAR_SALT;
    if (!salt) {
      console.error('[Talishar API] FABBAZAAR_SALT not configured');
      return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
    }

    const ts = parseInt(timestamp, 10);
    const nowSecs = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSecs - ts) > HASH_MAX_AGE_SECS) {
      return NextResponse.json({ success: false, error: 'Timestamp expired' }, { status: 403 });
    }

    const expectedHash = crypto
      .createHash('sha256')
      .update(metafyId + salt + timestamp)
      .digest('hex');

    if (metafyHash !== expectedHash) {
      return NextResponse.json({ success: false, error: 'Invalid hash' }, { status: 403 });
    }
  } else {
    // Legacy API key auth (until Talishar ships hash-based client)
    const validation = await validateTalisharRequest(request);
    if (!validation.valid) {
      return validation.response;
    }
  }

  // Resolve Metafy ID → internal user ID
  const userResult = await userService.findByMetafyId(metafyId);
  if (!userResult.success) {
    return NextResponse.json({ success: false, error: userResult.error }, { status: 500 });
  }
  if (!userResult.data) {
    return NextResponse.json({ success: true, decks: [] });
  }

  // Fetch decks for this user where availableOnTalishar = true
  const decksResult = await deckService.listUserDecks(
    userResult.data.id,
    { availableOnTalishar: true },
    { limit: 100 }
  );

  if (!decksResult.success) {
    return NextResponse.json({ success: false, error: decksResult.error }, { status: 500 });
  }

  const decks = decksResult.data.decks.map((deck) => ({
    name: deck.name,
    deckId: deck.publicId,
  }));

  return NextResponse.json({ success: true, decks });
}
