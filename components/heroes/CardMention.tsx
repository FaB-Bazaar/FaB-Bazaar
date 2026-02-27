"use client";

import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CardMentionProps {
  cardName: string;
  className?: string;
}

interface MiniCard {
  display_name: string;
  image_url: string;
  printing_id: string;
}

/**
 * A simple component for mentioning cards by name within text.
 * Searches for the card by name and shows a popover with the card image on hover.
 */
export default function CardMention({ cardName, className = "" }: CardMentionProps) {
  const [card, setCard] = React.useState<MiniCard | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchCardByName() {
      try {
        setLoading(true);
        // Search for card by name
        const response = await fetch(`/api/printings/search?name=${encodeURIComponent(cardName)}&limit=1&sortBy=name&sortOrder=asc&show=all`);

        if (response.ok) {
          const jsonResponse = await response.json();
          const cardData = jsonResponse?.data?.printings?.[0];

          if (cardData) {
            setCard(cardData);
          } else {
            setCard(null);
          }
        } else {
          setCard(null);
        }
      } catch (error) {
        console.error("Failed to fetch card by name:", error);
        setCard(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCardByName();
  }, [cardName]);

  // Show loading state
  if (loading) {
    return (
      <span className={`font-semibold italic text-muted-foreground ${className}`}>
        {cardName}
      </span>
    );
  }

  // If no card found, just show the name without popover
  if (!card) {
    return (
      <span className={`font-semibold ${className}`}>
        {cardName}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className={`font-semibold text-primary underline decoration-primary/50 decoration-dotted underline-offset-2 transition-colors hover:text-primary/80 cursor-pointer ${className}`}>
          {cardName}
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