// POST /api/partner/v1/decks/import — create a deck for the caller from a
// decklist in the FaBrary text format. Same importer as the in-app paste
// import (lib/deck/import-fabrary); this route only adds the partner contract.
import { bannedCardsService, deckService, printingsService } from '@/lib/services';
import { importFabraryDeck } from '@/lib/deck/import-fabrary';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';

const MAX_TEXT_LENGTH = 50_000;

export const POST = partnerRoute('decks:write', async ({ request, auth }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return partnerError(400, 'invalid_request', 'The body must be JSON.');
  }
  const text = body && typeof body === 'object' ? body.text : undefined;
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return partnerError(400, 'invalid_request', '"text" must be a decklist.');
  }

  const result = await importFabraryDeck(
    { userId: auth.userId, text },
    {
      createDeck: (userId, dto) => deckService.createDeck(userId, dto),
      addPrintings: (publicId, userId, printings) =>
        deckService.addPrintings(publicId, userId, printings as never),
      searchPrintings: async (filters, options) => {
        const r = await printingsService.searchPrintings(filters, options);
        return r.success ? { success: true, data: r.data.printings } : r;
      },
      bulkResolveByName: cards => printingsService.bulkResolveByName(cards),
      listExcludedHeroes: registryFormat => bannedCardsService.listExcludedHeroes(registryFormat as never),
    },
  );
  if (!result.success) return partnerError(400, 'invalid_decklist', result.error ?? 'Could not read the decklist.');

  const { publicId, deckName, format, hero, summary, unresolved } = result.data;
  return partnerOk(
    {
      deck: { id: publicId, name: deckName, format, hero: hero.name },
      cards_requested: summary.cardsRequested,
      cards_added: summary.cardsAdded,
      unresolved,
    },
    {},
    201,
  );
});
