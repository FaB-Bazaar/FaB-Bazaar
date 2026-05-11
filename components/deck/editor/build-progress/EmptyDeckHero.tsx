"use client";

import React from "react";
import { Sparkles, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface KitLike {
  id: string;
  name: string;
  description?: string | null;
  cards: Array<{ printingId: string; imageUrl?: string }>;
}

interface EmptyDeckHeroProps<K extends KitLike = KitLike> {
  deckName: string;
  kits: K[];
  loading?: boolean;
  onKitClick: (kit: K) => void;
  onSearchClick?: () => void;
}

const SKELETON_TILE_COUNT = 6;

const TILE_GRADIENTS = [
  "from-amber-500/20 to-amber-700/10 border-amber-500/40 hover:border-amber-400 hover:from-amber-500/30",
  "from-red-500/20 to-red-700/10 border-red-500/40 hover:border-red-400 hover:from-red-500/30",
  "from-blue-500/20 to-blue-700/10 border-blue-500/40 hover:border-blue-400 hover:from-blue-500/30",
  "from-violet-500/20 to-violet-700/10 border-violet-500/40 hover:border-violet-400 hover:from-violet-500/30",
  "from-emerald-500/20 to-emerald-700/10 border-emerald-500/40 hover:border-emerald-400 hover:from-emerald-500/30",
  "from-pink-500/20 to-pink-700/10 border-pink-500/40 hover:border-pink-400 hover:from-pink-500/30",
  "from-cyan-500/20 to-cyan-700/10 border-cyan-500/40 hover:border-cyan-400 hover:from-cyan-500/30",
];

export default function EmptyDeckHero<K extends KitLike>({
  deckName,
  kits,
  loading = false,
  onKitClick,
  onSearchClick,
}: EmptyDeckHeroProps<K>) {
  return (
    <section
      aria-label="Get started with your deck"
      className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-gray-900/60 to-gray-900/40 p-6 backdrop-blur-md shadow-[0_0_24px_rgba(59,130,246,0.15)]"
    >
      <header className="mb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-300" aria-hidden="true" />
          <h2 className="text-xl font-bold text-gray-100">
            Get started with <span className="text-blue-300">{deckName}</span>
          </h2>
        </div>
        <p className="text-sm text-gray-400">
          {loading
            ? "Loading curated starter kits…"
            : kits.length > 0
              ? "Pick a curated starter kit to add a batch of cards instantly — or search and brew from scratch."
              : "Search for cards or import a decklist to get going."}
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: SKELETON_TILE_COUNT }).map((_, i) => (
            <div
              key={i}
              data-kit-skeleton
              className="h-[164px] animate-pulse rounded-lg border-2 border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40"
            />
          ))}
        </div>
      ) : kits.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {kits.map((kit, i) => {
            const thumbs = kit.cards.filter((c) => c.imageUrl).slice(0, 4);
            return (
              <button
                key={kit.id}
                type="button"
                onClick={() => onKitClick(kit)}
                className={cn(
                  "group relative flex h-full flex-col items-start gap-3 overflow-hidden rounded-lg border-2 bg-gradient-to-br p-4 text-left transition-all",
                  "hover:scale-[1.02] hover:shadow-lg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  TILE_GRADIENTS[i % TILE_GRADIENTS.length]
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="text-base font-bold text-gray-100">{kit.name}</div>
                  <ArrowRight
                    className="h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>

                {thumbs.length > 0 && (
                  <div className="relative h-20 w-full">
                    {thumbs.map((card, idx) => {
                      const offset = (idx - (thumbs.length - 1) / 2) * 14;
                      const rotate = (idx - (thumbs.length - 1) / 2) * 5;
                      return (
                        <img
                          key={card.printingId}
                          data-kit-thumb
                          src={card.imageUrl}
                          alt=""
                          loading="lazy"
                          className="absolute left-1/2 top-0 h-20 w-auto rounded-md object-cover object-top shadow-lg ring-1 ring-black/40 transition-transform group-hover:translate-y-[-2px]"
                          style={{
                            aspectRatio: "63/88",
                            transform: `translateX(calc(-50% + ${offset}px)) rotate(${rotate}deg)`,
                            zIndex: idx,
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="mt-auto flex w-full items-center justify-between">
                  <span className="text-xs font-semibold tabular-nums text-gray-200">
                    {kit.cards.length} {kit.cards.length === 1 ? "card" : "cards"}
                  </span>
                  <Sparkles className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center text-sm text-gray-400">
          No starter kits available for this hero yet.
        </div>
      )}

      {onSearchClick && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-4">
          <span className="text-xs uppercase tracking-wider text-gray-500">Or</span>
          <button
            type="button"
            onClick={onSearchClick}
            className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search for cards
          </button>
          <span className="text-xs text-gray-500">
            (or press <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 font-sans text-[10px] font-bold text-gray-300">⌘K</kbd>)
          </span>
        </div>
      )}
    </section>
  );
}
