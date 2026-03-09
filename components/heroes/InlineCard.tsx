"use client"; // This component uses Popover, which is interactive.

import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MiniCard {
  display_name: string;
  image_url: string;
}

// Module-level cache — survives remounts, cleared on page navigation
const cardCache = new Map<string, MiniCard>();

interface InlineCardProps {
  printingId: string;
  children?: React.ReactNode;
  /** Legacy: Show only thumbnail image without name */
  thumbnail?: boolean;
  /** Legacy: Thumbnail size */
  size?: 'sm' | 'md';
  /** Show text-only mode (no thumbnail) - for backwards compatibility */
  textOnly?: boolean;
}

export default function InlineCard({ printingId, children, thumbnail = false, size = 'sm', textOnly = false }: InlineCardProps) {
  const [card, setCard] = React.useState<MiniCard | null>(null);

  // Thumbnail dimensions - small for inline display
  const thumbnailHeight = 20;  // Fits within 1.75 line-height
  const thumbnailWidth = 14;   // Maintains aspect ratio

  React.useEffect(() => {
    if (cardCache.has(printingId)) {
      setCard(cardCache.get(printingId)!);
      return;
    }
    async function fetchCardData() {
      try {
        const response = await fetch(`/api/printings/search?printingIds=${encodeURIComponent(printingId)}&show=all&limit=1`);

        if (response.ok) {
          const jsonResponse = await response.json();
          const cardData = jsonResponse?.data?.printings?.[0];

          if (cardData) {
            cardCache.set(printingId, cardData);
            setCard(cardData);
          } else {
            setCard(null);
          }
        } else {
          setCard(null);
        }
      } catch (error) {
        console.error("Failed to fetch inline card:", error);
        setCard(null);
      }
    }
    fetchCardData();
  }, [printingId]);

  // Get display name from children or card data
  const displayName = children ? String(children) : card?.display_name;

  // Loading state
  if (!card) {
    return (
      <span className="inline items-center gap-1">
        <span
          className="inline-block bg-muted animate-pulse rounded align-baseline"
          style={{
            width: `${thumbnailWidth}px`,
            height: `${thumbnailHeight}px`,
            verticalAlign: 'baseline'
          }}
        />
        <span className="font-semibold text-muted-foreground inline">{displayName || 'Loading...'}</span>
      </span>
    );
  }

  // Text-only mode (backwards compatibility)
  if (textOnly) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <span className="font-semibold text-primary underline decoration-primary/50 decoration-dotted underline-offset-2 transition-colors hover:text-primary/80 cursor-pointer">
            {displayName}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-none bg-transparent">
          <img
            src={card.image_url}
            alt={card.display_name}
            className="w-[250px] aspect-[63/88] rounded-lg shadow-xl"
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Default: Thumbnail + Name mode (consistent with match-report)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="inline items-center gap-1 cursor-pointer group">
          <img
            src={card.image_url}
            alt={card.display_name}
            title={`${card.display_name} - Click for larger view`}
            className="inline-block rounded shadow-sm object-cover transition-all group-hover:shadow-md group-hover:scale-110 align-baseline"
            style={{ width: `${thumbnailWidth}px`, height: `${thumbnailHeight}px`, verticalAlign: 'baseline' }}
          />
          <span className="font-semibold text-foreground group-hover:text-primary transition-colors inline">
            {displayName}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-none bg-transparent">
        <img
          src={card.image_url}
          alt={card.display_name}
          className="w-[250px] aspect-[63/88] rounded-lg shadow-xl"
        />
      </PopoverContent>
    </Popover>
  );
}