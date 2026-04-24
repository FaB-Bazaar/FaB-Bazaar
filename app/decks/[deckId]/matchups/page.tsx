"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Swords } from "lucide-react";
import { decksClient } from "@/lib/client";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import DeckMatchupsDialog from "@/components/deck/DeckMatchupsDialog";

export default function DeckMatchupsPage() {
  const params = useParams();
  const deckId = params.deckId as string;

  const [deck, setDeck] = useState<DeckDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    decksClient.getDeck(deckId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setDeck(res.data);
        } else {
          setError(res.error || "Failed to load deck");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deckId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-gray-300">{error || "Deck not found"}</p>
        <Link
          href={`/decks/${deckId}`}
          className="text-sm text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          ← Back to deck
        </Link>
      </div>
    );
  }

  const heroImg = deck.hero?.[0]?.printingDetails?.image_url;
  const heroLabel = deck.heroName
    || deck.hero?.[0]?.printingDetails?.display_name
    || deck.hero?.[0]?.printingDetails?.name
    || null;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <Link
            href={`/decks/${deckId}`}
            aria-label="Back to deck"
            className="flex items-center justify-center rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          {heroImg ? (
            <div className="w-11 h-14 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImg}
                alt={heroLabel || "Hero"}
                className="w-full h-full object-cover object-top"
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 flex-wrap">
              <Swords className="h-5 w-5 text-gray-400" aria-hidden="true" />
              <span className="truncate">Matchups</span>
              <span className="text-sm font-normal text-gray-300">·</span>
              <Link
                href={`/decks/${deckId}`}
                className="text-base md:text-lg font-normal text-gray-300 hover:text-white truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
              >
                {deck.name}
              </Link>
            </h1>
            <p className="text-sm text-gray-300 mt-0.5 flex items-center gap-2 flex-wrap">
              {deck.format && <span>{deck.format}</span>}
              {heroLabel && (
                <>
                  <span className="text-gray-500">·</span>
                  <span>{heroLabel}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Reuse existing inline editor (compact = no duplicate title) */}
        <DeckMatchupsDialog
          open
          onOpenChange={() => { /* inline mode: no-op */ }}
          deckId={deckId}
          deck={deck}
          inline
          compact
        />
      </div>
    </div>
  );
}
