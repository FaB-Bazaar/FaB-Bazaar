// components/deck/editor/DeckRightRail.tsx
"use client";

import React from "react";
import CollectionProgressBar from "./CollectionProgressBar";
import { cn } from "@/lib/utils";

interface PitchCounts {
  red: number;
  yellow: number;
  blue: number;
  none?: number;
}

interface DeckRightRailProps {
  pitchCounts: PitchCounts;
  averageCost?: number | null;
  ownedCount: number;
  totalCount: number;
  /** When set, a full card preview is rendered at the top of the rail. */
  hoveredCard?: { url: string; name: string; otherFaceUrl?: string } | null;
  /** Optional extra panels (e.g. matchups / results) appended to the rail. */
  extra?: React.ReactNode;
  className?: string;
}

const PITCH_ROWS: Array<{ key: keyof PitchCounts; label: string; dot: string; text: string }> = [
  { key: "red",    label: "Red",    dot: "bg-red-500",    text: "text-red-700 dark:text-red-300" },
  { key: "yellow", label: "Yellow", dot: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-300" },
  { key: "blue",   label: "Blue",   dot: "bg-blue-500",   text: "text-blue-700 dark:text-blue-300" },
  { key: "none",   label: "No Pitch", dot: "bg-gray-400", text: "text-gray-700 dark:text-gray-300" },
];

export default function DeckRightRail({
  pitchCounts,
  averageCost,
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
        <section aria-label="Card preview" className="-mx-2 -mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hoveredCard.url}
            alt={hoveredCard.name}
            className="w-full rounded-md ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm"
            style={{ aspectRatio: "63/88", objectFit: "cover", objectPosition: "top" }}
            draggable={false}
          />
        </section>
      )}

      <section role="region" aria-label="Deck Stats">
        <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">Deck Stats</h3>
        <ul className="space-y-1.5">
          {PITCH_ROWS.map(({ key, label, dot, text }) => {
            const count = pitchCounts[key] ?? 0;
            if (count === 0 && key === "none") return null;
            return (
              <li key={key} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", dot)} aria-hidden="true" />
                  <span className={text}>{label}</span>
                </span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{count}</span>
              </li>
            );
          })}
        </ul>
        {averageCost != null && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Average Cost</span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{averageCost.toFixed(1)}</span>
          </div>
        )}
      </section>

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
