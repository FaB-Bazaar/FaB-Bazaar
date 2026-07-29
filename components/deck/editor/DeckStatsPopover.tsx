"use client";

import { BarChart3, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildDeckStatsRows, type DeckStatsRowInput } from "./deck-stats-rows";

/**
 * Mobile "Stats" chip — collapses the secondary deck stats (no-pitch count,
 * average cost, zone counts) into a popover so the deck page's top rows stay
 * two lines tall: [Starter Kits · Explore · Stats] then the pitch chips.
 * Desktop keeps the same numbers inline; see app/decks/[deckId]/page.tsx.
 */
export function DeckStatsPopover({ className, ...stats }: DeckStatsRowInput & { className?: string }) {
  const rows = buildDeckStatsRows(stats);
  if (rows.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            "inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border text-sm transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 " +
            "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 " +
            "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 " +
            (className ?? "")
          }
          aria-label="Deck stats"
        >
          <BarChart3 className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <span className="font-medium">Stats</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <dl className="text-sm">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-2 py-1.5">
              <dt className="text-gray-600 dark:text-gray-300">{row.label}</dt>
              <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">{row.value}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
