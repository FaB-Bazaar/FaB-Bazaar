// components/deck/editor/DeckToolbarMoreMenu.tsx
"use client";

import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Download, Eye, Tv, Settings, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeckToolbarMoreMenuProps {
  onCopyList: () => void;
  onExport: () => void;
  onAnalyze: () => void;
  onPresent: () => void;
  onSettings: () => void;
  /** Optional — when provided and the user is an owner, exposes a deliberate way to swap unowned printings to owned alternatives. */
  onUpdateOwnedPrintings?: () => void;
  isOwner: boolean;
}

export default function DeckToolbarMoreMenu({
  onCopyList,
  onExport,
  onAnalyze,
  onPresent,
  onSettings,
  onUpdateOwnedPrintings,
  isOwner,
}: DeckToolbarMoreMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More actions"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium",
            "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200",
            "hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>More</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onCopyList}>
          <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
          Copy list
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExport}>
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          Export
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAnalyze}>
          <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
          Analyze
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPresent}>
          <Tv className="h-4 w-4 mr-2" aria-hidden="true" />
          Present
        </DropdownMenuItem>
        {isOwner && onUpdateOwnedPrintings && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onUpdateOwnedPrintings}>
              <ArrowLeftRight className="h-4 w-4 mr-2" aria-hidden="true" />
              Update to owned printings
            </DropdownMenuItem>
          </>
        )}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettings}>
              <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
              Settings
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
