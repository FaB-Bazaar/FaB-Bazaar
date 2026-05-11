"use client";

import { useMemo } from "react";
import { computeBuildProgress, type BuildProgress } from "@/lib/deck-builder/build-progress";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";

export function useBuildProgress(deck: DeckDTO | null, format: string | undefined): BuildProgress | null {
  return useMemo(() => {
    if (!deck || !format) return null;
    return computeBuildProgress(deck, format);
  }, [deck, format]);
}
