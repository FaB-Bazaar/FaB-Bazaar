// GET /api/partner/v1/play/decks/{deckId} — the deck as a game client imports
// it: the SAME export Talishar gets (lib/talishar/deck-export), from the list
// the player picked for Talishar (a saved version, else the deck as it is).
// Only for a deck the player sent to this app; anything else is 404.
//
// Query: matchup (a matchup plan's hero id — applies its sideboard swaps),
// include_art=1 (adds a collector number → image URL map).
import { deckService, printingsService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { buildTalisharDeckExport } from '@/lib/talishar/deck-export';

export const GET = partnerRoute<{ deckId: string }>('decks:read', async ({ request, auth, params }) => {
  const result = await deckService.findPartnerTalisharDeck(params.deckId, auth.userId, auth.clientId!);
  if (!result.success) {
    console.error('[PartnerAPI] play deck failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load the deck.');
  }
  if (!result.data) return partnerError(404, 'not_found', 'No such deck, or it is not sent to this app.');

  const url = new URL(request.url);
  const deck = await buildTalisharDeckExport(
    result.data,
    { matchupId: url.searchParams.get('matchup'), includeArt: url.searchParams.get('include_art') === '1' },
    {
      hasHeroPrinting: async (cardUniqueId) => {
        const found = await printingsService.searchPrintings({ cardUniqueId }, { limit: 1, show: 'all' });
        return Boolean(found.success && found.data.printings?.[0]);
      },
    },
  );
  return partnerOk(deck);
});
