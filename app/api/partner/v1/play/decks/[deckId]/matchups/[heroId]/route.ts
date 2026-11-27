// PUT /api/partner/v1/play/decks/{deckId}/matchups/{heroId} — save the plan
// against one hero (replacing any plan for that hero).
// DELETE … — remove it.
//
// {heroId} is a Talishar hero id ("briar_warden_of_thorns", young "briar") or
// a strategy id (core, aggro, fatigue, combo, midrange). Card ids in
// sideboard.in / sideboard.out are Talishar card ids ("sink_below_red"): `in`
// comes from the inventory, `out` from the main deck, one entry per copy.
//
// The plan is checked against the list the player sends to apps (the version
// picked for Talishar, else the live deck) and REJECTED with every problem
// listed — never silently trimmed, so a typo can't lose a card.
import { NextRequest } from 'next/server';
import { deckService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute, readJsonObject } from '@/lib/partner-api/route';
import { toPartnerMatchup } from '@/lib/partner-api/mappers';
import { validateMatchup } from '@/lib/validation/matchup-validation';
import type { DeckMatchup } from '@/types/deck';

type Params = { deckId: string; heroId: string };

const TURN_ORDERS = new Set(['First', 'Second', 'NoPreference']);
const MAX_SWAPS = 80;

const isCardIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= MAX_SWAPS && value.every(id => typeof id === 'string' && id.length > 0 && id.length <= 120);

/** The request body as a plan, or a message saying what is wrong with it. */
function readPlan(body: Record<string, unknown> | null, heroId: string): DeckMatchup | string {
  if (!body) return 'The body must be a JSON object.';
  const turn = body.preferred_turn_order ?? null;
  if (turn !== null && !(typeof turn === 'string' && TURN_ORDERS.has(turn))) {
    return '"preferred_turn_order" must be "First", "Second", "NoPreference" or null.';
  }
  const notes = body.notes ?? null;
  if (notes !== null && typeof notes !== 'string') return '"notes" must be text or null.';
  const sideboard = body.sideboard as { in?: unknown; out?: unknown } | undefined;
  if (!sideboard || typeof sideboard !== 'object' || !isCardIdList(sideboard.in) || !isCardIdList(sideboard.out)) {
    return `"sideboard" must have "in" and "out" lists of Talishar card ids (at most ${MAX_SWAPS} each).`;
  }
  return {
    heroId,
    preferredTurnOrder: turn as DeckMatchup['preferredTurnOrder'],
    notes: notes as string | null,
    sideboard: { in: sideboard.in, out: sideboard.out },
  };
}

async function playedDeck(params: Params, userId: string, clientId: string) {
  const result = await deckService.findPartnerTalisharDeck(params.deckId, userId, clientId);
  if (!result.success) {
    console.error('[PartnerAPI] matchup deck lookup failed:', result.error);
    return { error: partnerError(500, 'internal_error', 'Could not load the deck.') };
  }
  if (!result.data) return { error: partnerError(404, 'not_found', 'No such deck, or it is not sent to this app.') };
  return { deck: result.data };
}

export const PUT = partnerRoute<Params>('decks:write', async ({ request, auth, params }) => {
  const plan = readPlan(await readJsonObject(request as NextRequest), params.heroId);
  if (typeof plan === 'string') return partnerError(400, 'invalid_request', plan);

  const found = await playedDeck(params, auth.userId, auth.clientId!);
  if (found.error) return found.error;

  const validation = validateMatchup(plan, found.deck);
  if (!validation.valid) {
    return partnerError(400, 'invalid_matchup', validation.errors[0], { errors: validation.errors });
  }

  const saved = await deckService.saveDeckMatchup(params.deckId, auth.userId, plan);
  if (!saved.success) {
    console.error('[PartnerAPI] save matchup failed:', saved.error);
    return partnerError(500, 'internal_error', 'Could not save the matchup.');
  }
  return partnerOk(toPartnerMatchup(saved.data.matchup), {}, saved.data.created ? 201 : 200);
});

export const DELETE = partnerRoute<Params>('decks:write', async ({ auth, params }) => {
  const found = await playedDeck(params, auth.userId, auth.clientId!);
  if (found.error) return found.error;

  const deleted = await deckService.deleteDeckMatchup(params.deckId, auth.userId, params.heroId);
  if (!deleted.success) {
    console.error('[PartnerAPI] delete matchup failed:', deleted.error);
    return partnerError(500, 'internal_error', 'Could not delete the matchup.');
  }
  if (!deleted.data.deleted) return partnerError(404, 'not_found', 'This deck has no plan for that hero.');
  return partnerOk({ deleted: true });
});
