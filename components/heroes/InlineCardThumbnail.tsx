"use client";

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

interface InlineCardThumbnailProps {
  printingId: string;
  size?: 'sm' | 'md'; // sm=32px, md=48px height
  showPopover?: boolean;
  className?: string;
}

export default function InlineCardThumbnail({
  printingId,
  size = 'sm',
  showPopover = true,
  className = ''
}: InlineCardThumbnailProps) {
  const [card, setCard] = React.useState<MiniCard | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const height = size === 'sm' ? 32 : 48;
  // Card aspect ratio is 63:88, so width = height * (63/88)
  const width = Math.round(height * (63 / 88));

  React.useEffect(() => {
    if (cardCache.has(printingId)) {
      setCard(cardCache.get(printingId)!);
      setIsLoading(false);
      return;
    }
    async function fetchCardData() {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/printings/search?printingIds=${encodeURIComponent(printingId)}&show=all&limit=1`
        );

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
        console.error("Failed to fetch inline card thumbnail:", error);
        setCard(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCardData();
  }, [printingId]);

  // Loading state - show placeholder
  if (isLoading) {
    return (
      <span
        className={`inline-block bg-muted animate-pulse rounded ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    );
  }

  // No card found
  if (!card) {
    return (
      <span
        className={`inline-block bg-muted/50 rounded border border-dashed border-muted-foreground/30 ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
        title="Card not found"
      />
    );
  }

  const thumbnail = (
    <img
      src={card.image_url}
      alt={card.display_name}
      className={`inline-block rounded shadow-sm object-cover cursor-pointer hover:shadow-md transition-shadow ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      title={card.display_name}
    />
  );

  // Without popover, just return the thumbnail
  if (!showPopover) {
    return thumbnail;
  }

  // With popover - show larger image on hover
  return (
    <Popover>
      <PopoverTrigger asChild>
        {thumbnail}
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
