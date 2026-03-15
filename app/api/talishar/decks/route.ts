// GET /api/talishar/decks?metafyId=xxx
// Called by Talishar's backend to fetch a user's Talishar-enabled decks by Metafy ID.
import { NextRequest, NextResponse } from 'next/server';
import { validateTalisharRequest } from '@/lib/middleware/talishar-auth';
import { userService, deckService } from '@/lib/services';

export async function GET(request: NextRequest) {
  const validation = await validateTalisharRequest(request);
  if (!validation.valid) {
    return validation.response;
  }

  const { searchParams } = new URL(request.url);
  const metafyId = searchParams.get('metafyId');

  if (!metafyId) {
    return NextResponse.json(
      { success: false, error: 'metafyId query parameter is required' },
      { status: 400 }
    );
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
