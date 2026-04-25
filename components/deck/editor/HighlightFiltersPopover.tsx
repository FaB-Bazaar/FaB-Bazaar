// components/deck/editor/HighlightFiltersPopover.tsx
"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type HighlightFilterStat = "pitch" | "cost" | "power" | "defense" | "zone";

export interface HighlightFilter {
  stat: HighlightFilterStat;
  value: string | number;
}

interface HighlightFiltersPopoverProps {
  activeFilters: HighlightFilter[];
  onRemoveFilter: (filter: HighlightFilter) => void;
  onClearAll: () => void;
  /** The filter grid (pitch / cost / power / defense buttons) — provided as children for layout flexibility */
  children: React.ReactNode;
}

const STAT_LABELS: Record<HighlightFilterStat, string> = {
  pitch: "Pitch",
  cost: "Cost",
  power: "Power",
  defense: "Defense",
  zone: "Zone",
};

function chipLabel(filter: HighlightFilter): string {
  return `${STAT_LABELS[filter.stat]} ${filter.value}`;
}

export default function HighlightFiltersPopover({
  activeFilters,
  onRemoveFilter,
  onClearAll,
  children,
}: HighlightFiltersPopoverProps) {
  const count = activeFilters.length;
  const hasActive = count > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              hasActive
                ? "border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200"
                : "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700",
            )}
            aria-haspopup="dialog"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Highlight</span>
            {hasActive && (
              <span
                aria-label={`${count} active filter${count === 1 ? "" : "s"}`}
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-600 text-white text-xs font-bold leading-none"
              >
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[640px] p-3">
          {children}
        </PopoverContent>
      </Popover>

      {hasActive && (
        <>
          {activeFilters.map((f, idx) => (
            <span
              key={`${f.stat}-${f.value}-${idx}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60"
            >
              <span>{chipLabel(f)}</span>
              <button
                type="button"
                aria-label={`Remove ${STAT_LABELS[f.stat]} ${f.value} filter`}
                onClick={() => onRemoveFilter(f)}
                className="rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white underline underline-offset-2 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
