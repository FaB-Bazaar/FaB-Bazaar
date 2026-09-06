// GET /api/talishar/decks?metafyId=xxx&metafyHash=xxx&timestamp=xxx
// Called by the Talishar browser client to fetch a user's Talishar-enabled decks by Metafy ID.
// Auth: hash validation (browser) or API key (backend fallback)
import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://talishar.net',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
import { validateTalisharRequest, validateTalisharHmac } from '@/lib/middleware/talishar-auth';
import { userService, deckService } from '@/lib/services';
import { TALISHAR_HERO_IDS } from '@/lib/fab-constants/heroes';
import { hasTalisharMembership, hasFabBazaarMembership } from '@/lib/metafy/communities';

const FORMAT_MAP: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Future Classic Constructed': 'cc', // CC rules; Talishar has no future-pool format
  'Silver Age': 'sage',
  'Blitz': 'blitz',
  'Commoner': 'commoner',
  'Living Legend': 'cc',
  'Limited': 'draft',
  'Ultimate Pit Fight': 'upf',
  'Casual': 'open',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metafyId = searchParams.get('metafyId');
  const metafyHash = searchParams.get('metafyHash');
  const timestamp = searchParams.get('timestamp');

  if (!metafyId) {
    return NextResponse.json(
      { success: false, error: 'metafyId query parameter is required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (metafyHash && timestamp) {
    // Browser (Talishar frontend) path: time-limited HMAC, no API key needed
    const hmacResult = validateTalisharHmac(metafyId, metafyHash, timestamp, CORS_HEADERS);
    if (!hmacResult.valid) return hmacResult.response;
  } else {
    // Backend (Talishar server) path: static API key
    const validation = await validateTalisharRequest(request);
    if (!validation.valid) return validation.response;
  }

  // Resolve Metafy ID → internal user ID
  const userResult = await userService.findByMetafyId(metafyId);
  if (!userResult.success) {
    return NextResponse.json({ success: false, error: userResult.error }, { status: 500, headers: CORS_HEADERS });
  }
  if (!userResult.data) {
    return NextResponse.json({ success: true, decks: [] }, { headers: CORS_HEADERS });
  }

  // Verify the user is a member of both Talishar's and FabBazaar's Metafy communities.
  // This confirms the integration is properly set up on both sides.
  const communitiesResult = await userService.getMetafyCommunities(userResult.data.id);
  if (communitiesResult.success) {
    const communities = communitiesResult.data;
    if (!hasTalisharMembership(communities) || !hasFabBazaarMembership(communities)) {
      return NextResponse.json({ success: true, decks: [] }, { headers: CORS_HEADERS });
    }
  }

  // Fetch decks for this user where availableOnTalishar = true
  const decksResult = await deckService.listUserDecks(
    userResult.data.id,
    { availableOnTalishar: true },
    { limit: 100 }
  );

  if (!decksResult.success) {
    return NextResponse.json({ success: false, error: decksResult.error }, { status: 500, headers: CORS_HEADERS });
  }

  const decks = decksResult.data.decks.map((deck) => {
    // Resolve the hero from the deck's actual hero CARD first — its canonical
    // display_name is what TALISHAR_HERO_IDS is keyed on. The free-text heroName
    // column can hold a short/lowercase label (MCP enum, FaBrary "Hero:" line)
    // that fails to resolve, or a young-hero nickname that collides with the
    // adult printing. Fall back to heroName only when the deck has no hero card.
    const heroNameRaw = deck.hero?.[0]?.printingDetails?.display_name
      ?? deck.hero?.[0]?.printingDetails?.name
      ?? deck.heroName;
    return {
      id: deck.publicId,
      deckId: deck.publicId,
      name: deck.name,
      hero: heroNameRaw ? TALISHAR_HERO_IDS[heroNameRaw.toLowerCase()] : undefined,
      format: deck.format ? (FORMAT_MAP[deck.format] ?? deck.format.toLowerCase()) : undefined,
    };
  });

  return NextResponse.json({ success: true, decks }, { headers: CORS_HEADERS });
}
