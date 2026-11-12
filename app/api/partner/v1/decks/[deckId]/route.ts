// GET /api/partner/v1/decks/{deckId} — one of the caller's decks, with its cards.
// {deckId} is the deck's public id. The lookup only matches decks the caller
// owns or co-owns.
import { deckService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { toPartnerDeck } from '@/lib/partner-api/mappers';

export const GET = partnerRoute<{ deckId: string }>('decks:read', async ({ auth, params }) => {
  const result = await deckService.findByPublicId(params.deckId, auth.userId);
  if (!result.success) {
    console.error('[PartnerAPI] get deck failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load the deck.');
  }
  if (!result.data) return partnerError(404, 'not_found', 'No such deck.');
  return partnerOk(toPartnerDeck(result.data));
});
