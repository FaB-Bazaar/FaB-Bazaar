"use client";

// The deck page while a saved version is picked (?version=N): that version's
// cards in the deck page's shape, fetched once per version. `deck` is null
// until it arrives (and when no version is picked).

import { useEffect, useState } from "react";
import { decksClient } from "@/lib/client";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";

export function useVersionDeck(deckId: string, versionNumber: number | null): { deck: DeckDTO | null; error: string | null } {
  const [loaded, setLoaded] = useState<{ versionNumber: number; deck: DeckDTO } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (versionNumber == null) return;
    let cancelled = false;
    setError(null);
    decksClient.getDeckVersionDeck(deckId, versionNumber).then(res => {
      if (cancelled) return;
      if (res.success) setLoaded({ versionNumber, deck: res.data.deck });
      else setError(res.error || "Could not load that version.");
    });
    return () => { cancelled = true; };
  }, [deckId, versionNumber]);

  // Only ever hand back the version that is picked right now — never the last one.
  const deck = versionNumber != null && loaded?.versionNumber === versionNumber ? loaded.deck : null;
  return { deck, error: versionNumber != null ? error : null };
}
