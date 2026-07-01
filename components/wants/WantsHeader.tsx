// components/wants/WantsHeader.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Share2, Check, Clipboard, MoreHorizontal, ChevronUp } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";

interface WantsHeaderStats {
  totalCards: number;
  totalQuantity: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  estimatedValue: number;
}

interface WantsHeaderProps {
  stats: WantsHeaderStats;
  onAddCard: () => void;
  onExport: () => void;
  onShare: () => void;
  isExportCopied: boolean;
  isShareCopied: boolean;
}

export function WantsHeader({
  stats,
  onAddCard,
  onExport,
  onShare,
  isExportCopied,
  isShareCopied,
}: WantsHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 shadow-sm shadow-gray-200/80 dark:shadow-none">
      <div className="container mx-auto px-4 py-3">

        {/* Row 1: Title + desktop stats + desktop actions / mobile toggle */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 shrink-0">
            My Wants List
          </h1>

          {/* Desktop: inline stats */}
          <div className="hidden md:flex items-center gap-2 flex-1 min-w-0 px-2 flex-wrap">
            <Badge className="bg-blue-500 text-white">{stats.totalCards} unique</Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">{stats.totalQuantity} copies</span>
            {stats.highPriorityCount > 0 && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                {stats.highPriorityCount} high
              </Badge>
            )}
            {stats.mediumPriorityCount > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                {stats.mediumPriorityCount} medium
              </Badge>
            )}
            {stats.lowPriorityCount > 0 && (
              <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {stats.lowPriorityCount} low
              </Badge>
            )}
            {stats.estimatedValue > 0 && (
              <span className="text-sm text-green-600 dark:text-green-400 font-semibold">
                ~${stats.estimatedValue.toFixed(2)} (TCG Low)
              </span>
            )}
          </div>

          {/* Desktop: action buttons */}
          <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
            <Button
              onClick={onAddCard}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 h-9 text-sm px-4"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Card
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className={`transition-all duration-200 ${
                isExportCopied
                  ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {isExportCopied ? <Check className="h-4 w-4 mr-1" /> : <Clipboard className="h-4 w-4 mr-1" />}
              {isExportCopied ? 'Copied!' : 'Export'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className={`transition-all duration-200 ${
                isShareCopied
                  ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {isShareCopied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
              {isShareCopied ? 'Copied!' : 'Share'}
            </Button>
            <DarkModeToggle />
          </div>

          {/* Mobile: expand toggle + dark mode */}
          <div className="flex items-center gap-2 md:hidden ml-auto">
            <button
              onClick={() => setIsExpanded(v => !v)}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={isExpanded ? "Hide details" : "Show details"}
            >
              {isExpanded
                ? <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                : <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              }
            </button>
            <DarkModeToggle />
          </div>
        </div>

        {/* Mobile: Add Card button (always visible) */}
        <Button
          onClick={onAddCard}
          className="w-full mt-3 h-11 text-base bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 md:hidden"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add a Card to Your Wants
        </Button>

        {/* Mobile: expandable stats + actions */}
        {isExpanded && (
          <div className="mt-3 md:hidden space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-500 text-white">{stats.totalCards} unique cards</Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400 self-center">{stats.totalQuantity} copies</span>
              {stats.highPriorityCount > 0 && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{stats.highPriorityCount} high</Badge>
              )}
              {stats.mediumPriorityCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{stats.mediumPriorityCount} medium</Badge>
              )}
              {stats.lowPriorityCount > 0 && (
                <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{stats.lowPriorityCount} low</Badge>
              )}
              {stats.estimatedValue > 0 && (
                <span className="text-sm text-green-600 dark:text-green-400 font-semibold self-center">
                  ~${stats.estimatedValue.toFixed(2)} (TCG Low)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className={`flex-1 transition-all duration-200 ${
                  isExportCopied
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {isExportCopied ? <Check className="h-4 w-4 mr-1.5" /> : <Clipboard className="h-4 w-4 mr-1.5" />}
                {isExportCopied ? 'Copied!' : 'Export'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onShare}
                className={`flex-1 transition-all duration-200 ${
                  isShareCopied
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {isShareCopied ? <Check className="h-4 w-4 mr-1.5" /> : <Share2 className="h-4 w-4 mr-1.5" />}
                {isShareCopied ? 'Copied!' : 'Share'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
