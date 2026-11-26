"use client";

// The deck's saved versions for the rail deck page: one fetch shared by the
// header's version picker and the Versions view. Editors only — `enabled` is
// false for everyone else and nothing is requested.

import { useCallback, useEffect, useState } from "react";
import { decksClient } from "@/lib/client";
import type { DeckVersionSummary } from "@/lib/deck/deck-versions";

export interface DeckVersionsState {
  /** null while loading (or not enabled). */
  versions: DeckVersionSummary[] | null;
  error: string | null;
  reload: () => Promise<void>;
}

export function useDeckVersions(deckId: string, enabled: boolean): DeckVersionsState {
  const [versions, setVersions] = useState<DeckVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled || !deckId) return;
    const res = await decksClient.listDeckVersions(deckId);
    if (res.success) {
      setVersions(res.data.versions);
      setError(null);
    } else {
      setError(res.error || "Could not load this deck's versions.");
    }
  }, [deckId, enabled]);

  useEffect(() => { reload(); }, [reload]);

  return { versions, error, reload };
}
