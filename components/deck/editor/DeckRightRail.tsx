// components/deck/editor/DeckRightRail.tsx
"use client";

import React from "react";
import CollectionProgressBar from "./CollectionProgressBar";
import { TcgAffiliateLink } from "@/components/tracking";
import { cn } from "@/lib/utils";

const TCGPLAYER_LOGO_URL = "https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public";

function formatPrice(value: number | null | undefined): string | null {
  if (value == null || !isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

interface DeckRightRailProps {
  ownedCount: number;
  totalCount: number;
  /** When set, a full card preview is rendered at the top of the rail. */
  hoveredCard?: {
    url: string;
    name: string;
    otherFaceUrl?: string;
    tcgplayerUrl?: string;
    tcgLow?: number | null;
  } | null;
  /** Optional extra panels (e.g. matchups / results) appended to the rail. */
  extra?: React.ReactNode;
  className?: string;
}

export default function DeckRightRail({
  ownedCount,
  totalCount,
  hoveredCard,
  extra,
  className,
}: DeckRightRailProps) {
  return (
    <aside
      role="complementary"
      aria-label="Deck overview"
      className={cn(
        // top-20 (80px) ≈ global sticky navbar height — locks the rail just below it on scroll instead of underneath.
        "hidden xl:block w-72 flex-shrink-0 sticky top-20 self-start",
        "p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
        "space-y-4 text-sm text-gray-700 dark:text-gray-200",
        className,
      )}
    >
      {hoveredCard && (
        <section aria-label="Card preview" className="-mx-2 -mt-2 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hoveredCard.url}
            alt={hoveredCard.name}
            className="w-full rounded-md ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm"
            style={{ aspectRatio: "63/88", objectFit: "cover", objectPosition: "top" }}
            draggable={false}
          />
          {hoveredCard.tcgplayerUrl && (
            <TcgAffiliateLink
              tcgplayerUrl={hoveredCard.tcgplayerUrl}
              feature="DeckEditorRailPreview"
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              title={`Buy ${hoveredCard.name} on TCGplayer`}
            >
              <span>Buy on</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={TCGPLAYER_LOGO_URL} alt="TCGplayer" className="h-3.5 w-auto" />
              {formatPrice(hoveredCard.tcgLow) && (
                <span className="ml-auto tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatPrice(hoveredCard.tcgLow)}
                </span>
              )}
            </TcgAffiliateLink>
          )}
        </section>
      )}

      <section role="region" aria-label="Collection Progress">
        <CollectionProgressBar ownedCount={ownedCount} totalCount={totalCount} />
      </section>

      {extra && (
        <section role="region" aria-label="Additional details">
          {extra}
        </section>
      )}
    </aside>
  );
}
