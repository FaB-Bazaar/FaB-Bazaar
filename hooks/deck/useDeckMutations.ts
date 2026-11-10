"use client";

// Add / remove / move / quantity changes for a saved deck — the ONE copy both
// deck pages use (rail page + classic page). Rules live in
// lib/deck/deck-mutations (node-tested); this adds the toast, the refresh and
// the optimistic quantity.

import { useEffect, useRef, useState } from "react";
import { decksClient } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";
import {
  addCopies, createSettleTracker, moveCopies, removeCopies, withQuantity,
  type DeckMutationClient, type MutationOutcome,
} from "@/lib/deck/deck-mutations";

const client = decksClient as unknown as DeckMutationClient;

export function useDeckMutations({ deckId, deck, refreshDeck, applyDeck, refreshOwnership }: {
  deckId: string;
  deck: DeckDTO | null | undefined;
  refreshDeck: () => Promise<void>;
  /** With both of these, an add uses the deck its own response carries
   *  instead of requesting the deck again (useDeckEditor provides them). */
  applyDeck?: (deck: DeckDTO) => void;
  refreshOwnership?: () => void;
}) {
  const { toast } = useToast();

  // Quantity changes show at once; the server's deck replaces the guess when
  // the refresh lands (or reverts it on failure).
  const [optimistic, setOptimistic] = useState<DeckDTO | null>(null);
  useEffect(() => { setOptimistic(null); }, [deck]);
  const shown = optimistic ?? deck ?? null;

  const report = (title: string, outcome: MutationOutcome) => {
    if (!outcome.ok) toast({ title, description: outcome.error, variant: "destructive" });
    return outcome;
  };

  // After a mutation: take the deck the server already sent when there is one
  // (ownership refreshes in the background), otherwise fetch it. Overlapping
  // mutations (fast +1 clicks) end with one fetch — see createSettleTracker.
  const tracker = useRef(createSettleTracker()).current;
  const run = async (mutation: () => Promise<MutationOutcome>, title: string): Promise<MutationOutcome> => {
    tracker.begin();
    let outcome: MutationOutcome;
    try {
      outcome = await mutation();
    } catch (e) {
      outcome = { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
    }
    report(title, outcome);
    const how = tracker.end();
    if (how === "wait") return outcome;
    if (how === "apply" && outcome.ok && outcome.deck && applyDeck && refreshOwnership) {
      applyDeck(outcome.deck);
      refreshOwnership();
    } else {
      await refreshDeck();
    }
    return outcome;
  };

  /** Add copies to a zone. Resolves with the outcome so a dialog can keep itself open on failure. */
  const add = (printingId: string, category: DeckCategory, quantity: number): Promise<MutationOutcome> =>
    run(() => addCopies(client, deckId, printingId, category, quantity), "Add failed");

  /** Set a row's quantity — only the difference is added or removed. */
  const setQuantity = async (printingId: string, category: DeckCategory, newQty: number) => {
    if (!shown) return;
    const rows = (shown[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) ?? [];
    const delta = newQty - (rows.find(c => c.printingId === printingId)?.quantity ?? 0);
    if (delta === 0) return;
    setOptimistic(withQuantity(shown, printingId, category, newQty));
    // The deck always changes identity afterwards, even on failure, so views
    // holding their own optimistic state (DeckEditorListView) fall back to the
    // server's deck.
    const outcome = await run(() => (delta > 0
      ? addCopies(client, deckId, printingId, category, delta)
      : removeCopies(client, deckId, printingId, category, -delta)), "Update failed");
    if (!outcome.ok) setOptimistic(null);
  };

  /** Remove the whole row. */
  const remove = async (printingId: string, category: DeckCategory) => {
    await run(() => removeCopies(client, deckId, printingId, category, "all"), "Remove failed");
  };

  /** Move copies between zones; a rejected move puts them back (see moveCopies). */
  const move = async (printingId: string, from: DeckCategory, to: DeckCategory, quantity: number) => {
    await run(() => moveCopies(client, deckId, printingId, from, to, quantity), "Move failed");
  };

  return { deck: shown, add, setQuantity, remove, move };
}
