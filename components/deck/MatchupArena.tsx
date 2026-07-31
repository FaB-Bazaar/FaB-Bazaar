// components/deck/MatchupArena.tsx
// The /decks/[deckId]/matchups page: the matchup tile grid, rendered inline as
// the whole page on every viewport. Tapping a tile's ⚔ opens the Sideboard
// Plan overlay; owners edit through the same grid.
//
// This used to be a desktop "arena" (VS strip + opponent hero picker + Net
// composition / delta panel) with the manager dialog auto-opened on top —
// closing the dialog dropped owners into a second, different UI. The grid is
// now the single interface everywhere (mobile shipped this first).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { decksClient, heroesClient } from "@/lib/client";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { toTalisharIdentifier } from "@/lib/utils";
import { canEditDeck } from "@/lib/utils/deck-permissions";
import { useIsMobile } from "@/components/ui/use-mobile";

// Defer the heavy manager (and its MatchupSideboardEditor child) until needed.
const DeckMatchupsDialog = dynamic(() => import("@/components/deck/DeckMatchupsDialog"), {
  ssr: false,
});

interface MatchupArenaProps {
  deckId: string;
}

export default function MatchupArena({ deckId }: MatchupArenaProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [deck, setDeck] = useState<DeckDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Card-art fallback for heroes without a stylized portrait (heroPortraits.ts).
  // Young heroes (SA/Blitz) intentionally have no portraits saved — fall back to
  // the actual hero card image, cropped via `object-cover object-top` at render.
  const [heroCardImages, setHeroCardImages] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    decksClient.getDeck(deckId)
      .then((deckRes) => {
        if (cancelled) return;
        if (deckRes.success) setDeck(deckRes.data);
        else setError(deckRes.error || "Failed to load deck");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  // Fetch hero card images once we know the format. Used as a fallback in tile
  // rendering whenever a stylized portrait is missing (e.g. all young heroes).
  useEffect(() => {
    if (!deck?.format) return;
    const formatParam =
      deck.format === "Silver Age" || deck.format === "Blitz" ? "young" : "adult";
    let cancelled = false;
    heroesClient.getHeroPrintings(formatParam)
      .then((res) => {
        if (cancelled || !res.success) return;
        const map = new Map<string, string>();
        for (const h of res.data.heroes) {
          const tId = toTalisharIdentifier(h.name);
          if (tId && h.image_url) map.set(tId, h.image_url);
        }
        setHeroCardImages(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deck?.format]);

  const editable = canEditDeck(deck ?? { userId: null }, user?.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" aria-label="Loading" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-gray-300">{error || "Deck not found"}</p>
        <Link
          href={`/decks/${deckId}`}
          className="text-sm text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          ← Back to deck
        </Link>
      </div>
    );
  }

  // Non-owners get the same grid in read-only mode — swords only, no edit or
  // kebab. GET /matchups is public for non-private decks, so this works signed
  // out; the write routes 403 non-owners regardless.
  return (
    <div className="min-h-screen pb-24">
      <div className="px-3 py-3 sm:px-6 sm:py-4 max-w-7xl mx-auto">
        <div className="mb-2 flex items-start gap-2">
          <Link
            href={`/decks/${deckId}`}
            aria-label="Back to deck"
            className="flex items-center justify-center rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-gray-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Swords className="h-5 w-5 text-gray-600 dark:text-gray-300" aria-hidden="true" />
              <span className="truncate">Matchups</span>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
              {deck.name}
              {deck.format ? <span className="text-gray-500 dark:text-gray-400"> · {deck.format}</span> : null}
            </p>
          </div>
        </div>

        <DeckMatchupsDialog
          open
          onOpenChange={() => {}}
          deckId={deckId}
          deck={deck as any}
          inline
          compact
          readOnly={!editable}
          // Phones collapse the inert "No plan yet" tiles behind a disclosure
          // so tappable plans stay findable; desktop has the room to show them.
          collapseUnplanned={isMobile}
          heroCardImages={heroCardImages}
        />
      </div>
    </div>
  );
}
