// GET /api/partner/v1/play/decks/{deckId}/matchups — the deck's matchup
// (sideboard) plans, one per opposing hero. Card ids are Talishar ids. Only
// for a deck the player sent to this app.
import { deckService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { isWellFormedMatchup, toPartnerMatchup } from '@/lib/partner-api/mappers';

export const GET = partnerRoute<{ deckId: string }>('decks:read', async ({ auth, params }) => {
  const result = await deckService.findPartnerTalisharDeck(params.deckId, auth.userId, auth.clientId!);
  if (!result.success) {
    console.error('[PartnerAPI] list matchups failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load the matchups.');
  }
  if (!result.data) return partnerError(404, 'not_found', 'No such deck, or it is not sent to this app.');

  const stored: unknown[] = Array.isArray(result.data.metadata?.matchups) ? result.data.metadata.matchups : [];
  return partnerOk(stored.filter(isWellFormedMatchup).map(toPartnerMatchup));
});
