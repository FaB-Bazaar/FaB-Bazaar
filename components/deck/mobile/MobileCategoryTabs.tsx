// components/deck/mobile/MobileCategoryTabs.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeckCategory, Deck } from "./types";
import { CATEGORY_LABELS } from "./types";

interface MobileCategoryTabsProps {
  activeCategory: DeckCategory;
  onCategoryChange: (category: DeckCategory) => void;
  deck: Deck;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
}

const CATEGORIES: DeckCategory[] = ["hero", "equipment", "maindeck", "inventory"];

export default function MobileCategoryTabs({
  activeCategory,
  onCategoryChange,
  deck,
  viewMode,
  onViewModeChange,
}: MobileCategoryTabsProps) {
  const getCategoryCount = (category: DeckCategory): number => {
    return deck[category]?.length || 0;
  };

  return (
    <div className="sticky top-[73px] z-20 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        {/* Scrollable category pills */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((category) => {
            const count = getCategoryCount(category);
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                )}
              >
                {CATEGORY_LABELS[category]}
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] px-1",
                    isActive
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 shrink-0 border-l border-gray-300 dark:border-gray-700 pl-1.5 ml-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onViewModeChange("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onViewModeChange("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
