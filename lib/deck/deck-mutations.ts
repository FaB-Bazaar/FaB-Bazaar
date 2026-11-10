// Deck card mutations shared by the rail deck page and the classic page
// (hooks/deck/useDeckMutations wraps these with toasts + refresh).
//
// The bulk add route answers 200 with per-row outcomes: a copy-cap or legality
// rejection lives in results[i].error, not the envelope — every add here reads
// both. The client is passed in so this stays node-testable.

import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";

type AddRow = { printingId: string; quantity: number; category: DeckCategory };
type AddResult =
  | { success: true; data?: { results?: Array<{ printingId: string; success: boolean; error?: string }>; deck?: DeckDTO } }
  | { success: false; error?: string };
type RemoveResult = { success: true } | { success: false; error?: string };

export interface DeckMutationClient {
  addPrintings(deckId: string, rows: AddRow[]): Promise<AddResult>;
  removePrinting(deckId: string, printingId: string, category: DeckCategory, quantity?: number): Promise<RemoveResult>;
}

/** `deck` = the updated deck when the server sent one back (adds do; removes don't). */
export type MutationOutcome = { ok: true; deck?: DeckDTO } | { ok: false; error: string };

/** The remove route deletes the row when asked for more copies than it holds. */
const WHOLE_ROW = 999999;

const failed = (error: string | undefined, fallback: string): MutationOutcome => ({ ok: false, error: error || fallback });

export async function addCopies(
  client: DeckMutationClient, deckId: string, printingId: string, category: DeckCategory, quantity: number,
): Promise<MutationOutcome> {
  const result = await client.addPrintings(deckId, [{ printingId, quantity, category }]);
  if (!result.success) return failed(result.error, "Could not add the card.");
  const row = result.data?.results?.find(r => r.printingId === printingId && !r.success);
  if (row) return failed(row.error, "Could not add the card.");
  const deck = result.data?.deck;
  return deck ? { ok: true, deck } : { ok: true };
}

export async function removeCopies(
  client: DeckMutationClient, deckId: string, printingId: string, category: DeckCategory, quantity: number | "all",
): Promise<MutationOutcome> {
  const result = await client.removePrinting(deckId, printingId, category, quantity === "all" ? WHOLE_ROW : quantity);
  return result.success ? { ok: true } : failed(result.error, "Could not remove the card.");
}

/**
 * Move copies between zones: remove from the source, add to the target. The
 * remove goes first because the copy cap may count both zones. If the target
 * rejects the row, the copies go back to the source so nothing leaves the deck.
 */
export async function moveCopies(
  client: DeckMutationClient, deckId: string, printingId: string, from: DeckCategory, to: DeckCategory, quantity: number,
): Promise<MutationOutcome> {
  const removed = await removeCopies(client, deckId, printingId, from, quantity);
  if (!removed.ok) return removed;
  const added = await addCopies(client, deckId, printingId, to, quantity);
  if (added.ok) return added;
  const restored = await addCopies(client, deckId, printingId, from, quantity);
  if (restored.ok) return added;
  return { ok: false, error: `${added.error} The card was removed from the deck and could not be put back — add it again.` };
}

/** The deck with one row's quantity changed (row dropped at zero) — for optimistic display. */
export function withQuantity(deck: DeckDTO, printingId: string, category: DeckCategory, quantity: number): DeckDTO {
  const cards = [...((deck[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) ?? [])];
  const idx = cards.findIndex(c => c.printingId === printingId);
  if (idx === -1) return deck;
  if (quantity <= 0) cards.splice(idx, 1);
  else cards[idx] = { ...cards[idx], quantity };
  return { ...deck, [category]: cards };
}

/**
 * The deck a mutation returned, laid over the one on screen. GET /api/decks/[id]
 * adds viewer fields (canEdit, isCoOwner, ownerUsername) that the add route's
 * bare DTO lacks — those are kept.
 */
export function mergeServerDeck(current: DeckDTO | null | undefined, fresh: DeckDTO): DeckDTO {
  return current ? { ...current, ...fresh } : fresh;
}

/**
 * How a mutation should finish, given what else is in flight. On its own it
 * can `apply` the deck its response carried. When several overlap (three fast
 * +1 clicks) their responses can land out of order, so each `wait`s and the
 * last one to finish does a single `refetch`.
 */
export function createSettleTracker() {
  let inFlight = 0;
  let overlapped = false;
  return {
    begin() {
      if (inFlight > 0) overlapped = true;
      inFlight++;
    },
    end(): "apply" | "wait" | "refetch" {
      inFlight--;
      if (!overlapped) return "apply";
      if (inFlight > 0) return "wait";
      overlapped = false;
      return "refetch";
    },
  };
}
