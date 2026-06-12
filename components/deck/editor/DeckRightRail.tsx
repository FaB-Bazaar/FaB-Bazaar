// components/deck/editor/DeckRightRail.tsx
"use client";

import React from "react";
import CollectionProgressBar from "./CollectionProgressBar";
import { TcgAffiliateLink } from "@/components/tracking";
import { RarityIcon } from "@/components/shared/RarityIcon";
import { getSetImageOrFallback } from "@/lib/set-images";
import { cn } from "@/lib/utils";

const TCGPLAYER_LOGO_URL = "https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public";

const PITCH_DOT_BY_VALUE: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-400",
  3: "bg-blue-500",
};

const FOILING_LABEL: Record<string, string> = {
  c: "Cold Foil",
  r: "Rainbow Foil",
  g: "Gold Foil",
};

const EDITION_LABEL: Record<string, string> = {
  f: "1st",
  u: "Unlimited",
  a: "Alpha",
};

function formatPrice(value: number | null | undefined): string | null {
  if (value == null || !isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function fmtNum(v: number | null | undefined): string {
  return v == null ? "—" : String(v);
}

interface DeckRightRailProps {
  ownedCount: number;
  totalCount: number;
  /** When set, a full card preview is rendered at the top of the rail. */
  hoveredCard?: {
    url: string;
    name: string;
    printingId?: string;
    otherFaceUrl?: string;
    tcgplayerUrl?: string;
    tcgLow?: number | null;
    /** Printing identity */
    collectorNumber?: string;
    setCode?: string;
    edition?: string;
    foiling?: string;
    rarity?: string;
    /** Card stats */
    pitch?: number | null;
    cost?: number | null;
    power?: number | null;
    defense?: number | null;
    typeText?: string;
    /** Per-card ownership: how many copies the user owns (capped at needed) */
    ownedInDeck?: number;
    /** Per-card ownership: how many copies the deck needs */
    neededInDeck?: number;
  } | null;
  /** Optional extra panels (e.g. matchups / results) appended to the rail. */
  extra?: React.ReactNode;
  className?: string;
}

// top-20 (80px) ≈ global sticky navbar height — the rail pins just below it on scroll.
const NAVBAR_OFFSET_PX = 80;

export default function DeckRightRail({
  ownedCount,
  totalCount,
  hoveredCard,
  extra,
  className,
}: DeckRightRailProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  // Horizontal position of the rail while pinned; null = in normal flow.
  const [fixedLeft, setFixedLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrapperRef.current;
      if (!el || el.offsetWidth === 0) {
        // display:none below the xl breakpoint
        setFixedLeft(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setFixedLeft(rect.top <= NAVBAR_OFFSET_PX ? rect.left : null);
    };
    const onScrollOrResize = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    // In-flow placeholder that reserves the rail's column in the flex row. The aside pins via
    // position:fixed (not sticky) once the placeholder scrolls up to the navbar line — sticky
    // would get dragged up at the end of the page because it can never leave its flex-row
    // parent, and the global footer (below the row) doesn't extend that boundary.
    <div ref={wrapperRef} className="hidden xl:block w-72 flex-shrink-0 self-start">
      <aside
        role="complementary"
        aria-label="Deck overview"
        style={fixedLeft != null ? { position: "fixed", top: NAVBAR_OFFSET_PX, left: fixedLeft } : undefined}
        className={cn(
          "w-72 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
          "space-y-4 text-sm text-gray-700 dark:text-gray-200",
          // While pinned, never extend past the viewport bottom — scroll internally instead.
          fixedLeft != null && "max-h-[calc(100vh-6rem)] overflow-y-auto",
          className,
        )}
      >
        {hoveredCard && (() => {
          const foilingLabel = hoveredCard.foiling ? FOILING_LABEL[hoveredCard.foiling.toLowerCase()] : null;
          const editionLabel = hoveredCard.edition ? EDITION_LABEL[hoveredCard.edition.toLowerCase()] : null;
          // Line 2 carries printing-treatment bits (edition, foiling). Collector number lives in line 1 next to the name.
          const treatmentBits = [editionLabel, foilingLabel].filter(Boolean);
          const hasPitch = hoveredCard.pitch != null && hoveredCard.pitch > 0;
          const hasCost = hoveredCard.cost != null;
          const hasPD = hoveredCard.power != null || hoveredCard.defense != null;

          return (
            <section aria-label="Card preview" className="-mx-2 -mt-2 space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hoveredCard.url}
                alt={hoveredCard.name}
                className="w-full rounded-md ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm"
                style={{ aspectRatio: "63/88", objectFit: "cover", objectPosition: "top" }}
                draggable={false}
              />

              {/* Card name + printing identity
                  Line 1: card name — collector number (e.g. "Demolition Protocol — FAB174")
                  Line 2: rarity icon · edition · foiling
                  Line 3: type text */}
              <div className="space-y-1">
                {hoveredCard.setCode && getSetImageOrFallback(hoveredCard.setCode, hoveredCard.setCode) && (
                  <div className="flex justify-center pt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getSetImageOrFallback(hoveredCard.setCode, hoveredCard.setCode)}
                      alt={hoveredCard.setCode.toUpperCase()}
                      title={hoveredCard.setCode.toUpperCase()}
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                )}
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={hoveredCard.name}>
                  {hoveredCard.name}
                  {hoveredCard.collectorNumber && (
                    <span className="font-normal text-gray-500 dark:text-gray-400 font-mono"> — {hoveredCard.collectorNumber}</span>
                  )}
                </div>
                {(treatmentBits.length > 0 || hoveredCard.rarity) && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
                    {hoveredCard.rarity && <RarityIcon rarityCode={hoveredCard.rarity} size="sm" />}
                    {treatmentBits.length > 0 && <span>{treatmentBits.join(" · ")}</span>}
                  </div>
                )}
                {hoveredCard.typeText && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={hoveredCard.typeText}>
                    {hoveredCard.typeText}
                  </div>
                )}
              </div>

              {/* Card stats row — uses the project's FaB stat icons (same set the highlight bar uses)
                  so it reads as game info, not debug output */}
              {(hasPitch || hasCost || hasPD) && (
                <div className="flex items-center justify-center gap-2.5 text-sm text-gray-700 dark:text-gray-200">
                  {hasPitch && (
                    <span className="inline-flex items-center" title={`Pitch ${hoveredCard.pitch}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/fab/symbols/pitch${hoveredCard.pitch}.png`} alt={`Pitch ${hoveredCard.pitch}`} className="w-5 h-5 object-contain" />
                    </span>
                  )}
                  {hasCost && (
                    <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0" title={`Cost ${hoveredCard.cost}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/fab/symbols/cost.png" alt="Cost" className="w-5 h-5 object-contain" />
                      <span className="absolute font-bold text-[10px] leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,1)]">
                        {fmtNum(hoveredCard.cost)}
                      </span>
                    </span>
                  )}
                  {hoveredCard.power != null && (
                    <span className="inline-flex items-center gap-1 tabular-nums font-semibold" title={`Power ${hoveredCard.power}`}>
                      <span>{hoveredCard.power}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/fab/symbols/power.png" alt="Power" className="w-4 h-4 object-contain" />
                    </span>
                  )}
                  {hoveredCard.defense != null && (
                    <span className="inline-flex items-center gap-1 tabular-nums font-semibold" title={`Defense ${hoveredCard.defense}`}>
                      <span>{hoveredCard.defense}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/fab/symbols/block.png" alt="Defense" className="w-4 h-4 object-contain" />
                    </span>
                  )}
                </div>
              )}

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

              {hoveredCard.neededInDeck != null && hoveredCard.neededInDeck > 0 && (() => {
                const owned = hoveredCard.ownedInDeck ?? 0;
                const needed = hoveredCard.neededInDeck!;
                const colorClass = owned >= needed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : owned > 0
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400";
                return (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">Owned</span>
                    <span className={cn("font-semibold tabular-nums", colorClass)}>
                      {owned} / {needed}
                    </span>
                  </div>
                );
              })()}
            </section>
          );
        })()}

        <section role="region" aria-label="Collection Progress">
          <CollectionProgressBar ownedCount={ownedCount} totalCount={totalCount} />
        </section>

        {extra && (
          <section role="region" aria-label="Additional details">
            {extra}
          </section>
        )}
      </aside>
    </div>
  );
}
