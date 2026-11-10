"use client";

// Add / remove / move / quantity changes for a saved deck — the ONE copy both
// deck pages use (rail page + classic page). Rules live in
// lib/deck/deck-mutations (node-tested); this adds the toast, the refresh and
// the optimistic quantity.

import { useEffect, useState } from "react";
import { decksClient } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";
import {
  addCopies, moveCopies, removeCopies, withQuantity,
  type DeckMutationClient, type MutationOutcome,
} from "@/lib/deck/deck-mutations";

const client = decksClient as unknown as DeckMutationClient;

export function useDeckMutations({ deckId, deck, refreshDeck }: {
  deckId: string;
  deck: DeckDTO | null | undefined;
  refreshDeck: () => Promise<void>;
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

  /** Add copies to a zone. Resolves with the outcome so a dialog can keep itself open on failure. */
  const add = async (printingId: string, category: DeckCategory, quantity: number): Promise<MutationOutcome> => {
    const outcome = report("Add failed", await addCopies(client, deckId, printingId, category, quantity));
    await refreshDeck();
    return outcome;
  };

  /** Set a row's quantity — only the difference is added or removed. */
  const setQuantity = async (printingId: string, category: DeckCategory, newQty: number) => {
    if (!shown) return;
    const rows = (shown[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) ?? [];
    const delta = newQty - (rows.find(c => c.printingId === printingId)?.quantity ?? 0);
    if (delta === 0) return;
    setOptimistic(withQuantity(shown, printingId, category, newQty));
    const outcome = report("Update failed", delta > 0
      ? await addCopies(client, deckId, printingId, category, delta)
      : await removeCopies(client, deckId, printingId, category, -delta));
    if (!outcome.ok) setOptimistic(null);
    // Always refresh, even on failure, so views holding their own optimistic
    // state (DeckEditorListView) fall back to the server's deck.
    await refreshDeck();
  };

  /** Remove the whole row. */
  const remove = async (printingId: string, category: DeckCategory) => {
    report("Remove failed", await removeCopies(client, deckId, printingId, category, "all"));
    await refreshDeck();
  };

  /** Move copies between zones; a rejected move puts them back (see moveCopies). */
  const move = async (printingId: string, from: DeckCategory, to: DeckCategory, quantity: number) => {
    report("Move failed", await moveCopies(client, deckId, printingId, from, to, quantity));
    await refreshDeck();
  };

  return { deck: shown, add, setQuantity, remove, move };
}
