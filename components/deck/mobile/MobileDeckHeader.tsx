// components/deck/mobile/MobileDeckHeader.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MoreHorizontal, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Deck } from "./types";

interface MobileDeckHeaderProps {
  deck: Deck;
  totalCards: number;
  onMenuOpen: () => void;
  canEdit?: boolean;
  onEditName?: () => void;
}

export default function MobileDeckHeader({
  deck,
  totalCards,
  onMenuOpen,
  canEdit = false,
  onEditName,
}: MobileDeckHeaderProps) {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
      {/* Row 1: Back + Name + Count + Menu */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => router.push("/decks")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 flex-1 min-w-0">
          <h1 className="text-base font-bold truncate flex-1 min-w-0">
            {deck.name}
          </h1>
          {canEdit && onEditName && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={onEditName}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        <span className="text-xs text-gray-500 shrink-0">
          {totalCards} cards
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={onMenuOpen}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 2: Scrollable info pills */}
      <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto scrollbar-hide">
        <Badge variant="secondary" className="shrink-0 text-xs">
          {deck.format}
        </Badge>
        <Badge
          variant={deck.isPublic ? "default" : "outline"}
          className="shrink-0 text-xs"
        >
          {deck.isPublic ? "Public" : "Private"}
        </Badge>
        {deck.heroName && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {deck.heroName}
          </Badge>
        )}
        {deck.estimatedValue > 0 && (
          <Badge variant="outline" className="shrink-0 text-xs text-green-600">
            ~${deck.estimatedValue.toFixed(2)}
          </Badge>
        )}
      </div>
    </div>
  );
}
