// components/deck/editor/CollectionProgressBar.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CollectionProgressBarProps {
  ownedCount: number;
  totalCount: number;
}

export default function CollectionProgressBar({ ownedCount, totalCount }: CollectionProgressBarProps) {
  const safeOwned = Math.max(0, Math.min(ownedCount, totalCount));
  const safeTotal = Math.max(0, totalCount);
  const segments = Array.from({ length: safeTotal }, (_, i) => i < safeOwned);
  const isComplete = safeTotal > 0 && safeOwned >= safeTotal;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Collection Progress</div>
      <div
        role="progressbar"
        aria-valuenow={safeOwned}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={`${safeOwned} of ${safeTotal} cards owned`}
        className="flex flex-wrap gap-[2px]"
      >
        {segments.map((filled, i) => (
          <span
            key={i}
            data-segment={filled ? "filled" : "empty"}
            className={cn(
              "h-2 flex-1 min-w-[6px] rounded-sm",
              filled
                ? isComplete
                  ? "bg-emerald-500"
                  : "bg-emerald-400 dark:bg-emerald-500"
                : "bg-gray-200 dark:bg-gray-700",
            )}
          />
        ))}
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <span className="font-semibold">{safeOwned} / {safeTotal}</span> Cards Owned
      </div>
    </div>
  );
}
