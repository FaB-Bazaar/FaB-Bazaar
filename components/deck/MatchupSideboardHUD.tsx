// components/deck/MatchupSideboardHUD.tsx
// NOTE: This component is no longer used in the matchups tab.
// The gallery is now rendered directly inside DeckMatchupsDialog (inline mode).
// Keeping this file in case the dormant-pill pattern is useful elsewhere.
"use client";

import React from "react";
import { Swords } from "lucide-react";

export interface ResolvedCard {
  talisharId: string;
  displayName: string;
  pitch: 1 | 2 | 3 | null;
  printingId?: string;
}

/** Dormant pill shown at the bottom of the screen when matchups exist. */
export default function MatchupSideboardHUD({ hasMatchups }: { hasMatchups: boolean }) {
  if (!hasMatchups) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 chord-chip-enter pointer-events-none"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 bg-black/40 border border-blue-400/60 rounded-full px-5 py-2 backdrop-blur-md shadow-[0_0_12px_rgba(96,165,250,0.25)]">
        <Swords className="h-4 w-4 text-blue-400/70" aria-hidden="true" />
        <span className="text-sm text-gray-300 font-sans">
          Tap <span className="font-bold">Deck</span> or <span className="font-bold">Inv</span> on any matchup to view cards
        </span>
      </div>
    </div>
  );
}
