// POST /api/partner/v1/decks/{deckId}/cards/remove — take copies of cards out
// of one of the caller's decks, by printing and zone. Afterwards the deck's
// matchup plans are tidied the same way the app does it, so no plan keeps
// pointing at a card that is gone.
import { deckService } from '@/lib/services';
import { normalizeDeckCategory, DECK_CATEGORIES } from '@/lib/deck/deck-category';
import { sanitizeAllMatchups } from '@/lib/validation/matchup-validation';
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
    const category = normalizeDeckCategory(card.zone ?? 'maindeck');
    if (!category) {
      results.push({
        printing_id: card.printingId,
        removed: false,
        reason: 'invalid_zone',
        message: `Zones: ${DECK_CATEGORIES.join(', ')} ("sideboard" means inventory).`,
      });
      continue;
    }
    const result = await deckService.removePrinting(params.deckId, auth.userId, card.printingId, category, card.quantity);
    results.push(
      result.success
        ? { printing_id: card.printingId, removed: true, zone: category, quantity: card.quantity }
        : { printing_id: card.printingId, removed: false, reason: 'not_found' },
    );
  }

  // Matchup plans must not keep entries for cards that are gone (same step the
  // in-app remove route runs).
  if (results.some(r => r.removed)) {
    const after = await deckService.findByPublicId(params.deckId, auth.userId);
    const matchups = after.success ? after.data?.metadata?.matchups : undefined;
    if (after.success && after.data && Array.isArray(matchups) && matchups.length > 0) {
      const { matchups: sanitized, changed } = sanitizeAllMatchups(matchups, after.data);
      if (changed) {
        await deckService.updateDeck(params.deckId, auth.userId, {
          metadata: { ...after.data.metadata, matchups: sanitized },
        });
      }
    }
  }

  const removed = results.filter(r => r.removed).length;
  return partnerOk({ removed, failed: results.length - removed, results });
});
