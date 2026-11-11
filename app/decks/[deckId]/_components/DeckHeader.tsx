"use client";

// The deck page's header: the hero's art, the deck's name and line, and the
// pitch split as a bar — what the deck IS, before any tool. Flat fills only
// (no gradients or glows, see components/CLAUDE.md).

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { pitchSplit } from "@/lib/deck/deck-lens";
import { CardDetailsLightbox, type LightboxCard } from "@/components/cards/CardDetailsLightbox";
import { fetchPrintingsForCard, type PrintingResult } from "@/lib/client/hero-pool-cache";

const PITCHES = [
  { key: "red", fill: "bg-red-500" },
  { key: "yellow", fill: "bg-yellow-400" },
  { key: "blue", fill: "bg-blue-500" },
] as const;

export default function DeckHeader({ deck, heroName, line, children }: {
  deck: DeckDTO;
  heroName?: string;
  /** "Hero · Format · 64 cards + 16 inventory" */
  line: string;
  /** Right-hand actions (read-only viewers: Copy deck). */
  children?: ReactNode;
}) {
  const split = useMemo(() => pitchSplit(deck), [deck]);
  const pitched = split.red + split.yellow + split.blue;
  const hero = deck.hero?.[0];
  const heroArt = hero?.printingDetails?.image_url;

  // The hero art opens the hero in the card overlay, like the small hero tile
  // in the grid — but from every view (Table, Prices, Results…), so the header
  // owns its own lightbox. Same shape as DeckTable's: the deck row shows at
  // once, the full search row (legality, artist) is swapped in when it arrives.
  const [heroCard, setHeroCard] = useState<LightboxCard | null>(null);
  // The lightbox leaves Escape to its host.
  useEffect(() => {
    if (!heroCard) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setHeroCard(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [heroCard]);
  const openHero = () => {
    const d = hero?.printingDetails;
    if (!hero || !d) return;
    const printingId = hero.printingId;
    setHeroCard({
      name: (d.display_name || d.name || heroName || "Hero") as string,
      printing: { ...d, printing_id: printingId, type_text: d.type_text ?? d.type_text_display } as PrintingResult,
    });
    const uid = d.card_unique_id as string | undefined;
    if (!uid) return;
    fetchPrintingsForCard(uid).then(found => {
      const full = (found as unknown as PrintingResult[]).find(p => p.printing_id === printingId);
      if (full) setHeroCard(prev => (prev && prev.printing.printing_id === printingId ? { ...prev, printing: full } : prev));
    }).catch(() => { /* the deck row is already showing */ });
  };

  return (
    <header className="mb-5 flex items-center gap-4 border-b border-gray-200 pb-4 dark:border-gray-800">
      {heroArt && (
        // The card's top half: name bar + art, the same crop as a deck tile.
        <button
          type="button"
          onClick={openHero}
          aria-label={`View hero ${heroName ?? ""}`.trim()}
          title="View hero card"
          className="aspect-[63/53] w-28 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-gray-300 bg-gray-200 hover:border-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-400"
        >
          <img src={heroArt} alt={heroName ?? "Hero"} className="w-full max-w-none" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{deck.name}</h1>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{line}</p>
        {pitched > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <div
              role="img"
              aria-label={`Pitch: ${split.red} red, ${split.yellow} yellow, ${split.blue} blue`}
              className="flex h-2 w-56 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
            >
              {PITCHES.map(p => split[p.key] > 0 && (
                <span key={p.key} className={p.fill} style={{ width: `${(split[p.key] / pitched) * 100}%` }} />
              ))}
            </div>
            {PITCHES.map(p => (
              <span key={p.key} className="flex items-center gap-1.5 tabular-nums">
                <span className={`h-2 w-2 rounded-full ${p.fill}`} aria-hidden />
                {split[p.key]} {p.key}
              </span>
            ))}
            {split.averageCost != null && (
              <span className="tabular-nums">Average cost {split.averageCost.toFixed(1)}</span>
            )}
          </div>
        )}
      </div>
      {children}
      {heroCard && (
        <CardDetailsLightbox
          card={heroCard}
          onClose={() => setHeroCard(null)}
          onSelectPrinting={printing => setHeroCard(prev => (prev ? { ...prev, printing } : prev))}
          deckFormat={deck.format}
        />
      )}
    </header>
  );
}
