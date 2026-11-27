// GET /api/partner/v1/play/decks — the decks the player sent to THIS app
// (deck Settings → "Send to"), most recently changed first. For game clients
// such as Cintari: each entry links to its playable list.
//
// Query: format (a deck format as named on FaB Bazaar, e.g. "Classic
// Constructed", "Blitz", "Silver Age"), page (from 1), limit (1–100, default 50).
import { deckService } from '@/lib/services';
import { intParam, partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { toPartnerPlayDeck } from '@/lib/partner-api/mappers';

export const GET = partnerRoute('decks:read', async ({ request, auth }) => {
  const url = new URL(request.url);
  const page = intParam(url, 'page', 1, Number.MAX_SAFE_INTEGER);
  const limit = intParam(url, 'limit', 50, 100);
  const format = url.searchParams.get('format')?.trim() || undefined;

  // A partner token always names its app (lib/oauth/partner-token).
  const result = await deckService.listPartnerDecks(auth.userId, auth.clientId!, { format, limit, offset: (page - 1) * limit });
  if (!result.success) {
    console.error('[PartnerAPI] list play decks failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load decks.');
  }

  const { decks, total } = result.data;
  return partnerOk(decks.map(toPartnerPlayDeck), {
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
});
