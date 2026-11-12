// POST /api/partner/v1/decks/{deckId}/cards — add cards to one of the caller's
// decks. The deck's own rules apply exactly as in the app (format legality,
// banned cards, copy limits, equipment slots); a card they reject is reported
// per card and the rest still go in. The banned-card bypass the app gives
// superadmins is never used here.
import { deckService } from '@/lib/services';
import { normalizeDeckCategory, DECK_CATEGORIES } from '@/lib/deck/deck-category';
import { listOf, partnerError, partnerOk, partnerRoute, quantityOf, readJsonObject } from '@/lib/partner-api/route';

const MAX_CARDS = 200;

export const POST = partnerRoute<{ deckId: string }>('decks:write', async ({ request, auth, params }) => {
  const body = await readJsonObject(request);
  const entries = body ? listOf(body.cards, MAX_CARDS) : null;
  if (!entries) {
    return partnerError(400, 'invalid_request', `"cards" must be a list of 1 to ${MAX_CARDS} entries.`);
  }

  const cards: Array<{ printingId: string; quantity: number; zone: unknown }> = [];
  for (let i = 0; i < entries.length; i++) {
    const printingId = entries[i].printing_id;
    const quantity = quantityOf(entries[i].quantity);
    if (typeof printingId !== 'string' || !printingId) {
      return partnerError(400, 'invalid_request', `cards[${i}].printing_id is required.`);
    }
    if (quantity === null) {
      return partnerError(400, 'invalid_request', `cards[${i}].quantity must be a whole number from 1 to 999.`);
    }
    cards.push({ printingId, quantity, zone: entries[i].zone });
  }

  const deck = await deckService.findByPublicId(params.deckId, auth.userId);
  if (!deck.success || !deck.data) return partnerError(404, 'not_found', 'No such deck.');

  const results = [];
  for (const card of cards) {
    // An omitted zone lets the deck place the card by its type.
    const category = card.zone == null ? undefined : normalizeDeckCategory(card.zone);
    if (category === null) {
      results.push({
        printing_id: card.printingId,
        added: false,
        reason: 'invalid_zone',
        message: `Zones: ${DECK_CATEGORIES.join(', ')} ("sideboard" means inventory).`,
      });
      continue;
    }

    const result = await deckService.addPrinting(params.deckId, auth.userId, {
      printingId: card.printingId,
      quantity: card.quantity,
      category,
    });
    if (result.success && result.data.success) {
      results.push({
        printing_id: card.printingId,
        added: true,
        name: result.data.cardName ?? null,
        zone: result.data.category ?? category ?? null,
        quantity: result.data.quantity ?? card.quantity,
      });
    } else {
      results.push({
        printing_id: card.printingId,
        added: false,
        reason: 'rejected',
        message: (result.success ? result.data.error : result.error) ?? 'The deck did not accept this card.',
      });
    }
  }

  const added = results.filter(r => r.added).length;
  return partnerOk({ added, failed: results.length - added, results });
});
