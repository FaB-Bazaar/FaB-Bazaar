// components/heroes/ContentRenderer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import PublicCardDisplay from '@/components/shared/PublicCardDisplay'; // Reuse the component we made!

interface ContentBlock {
  type: 'paragraph' | 'heading' | 'decklist' | 'card_spotlight';
  title?: string;
  text?: string;
  printingIds?: string[];
}

interface ContentRendererProps {
  blocks: ContentBlock[];
}

// A small component to render a single content block
const ContentBlockDisplay = ({ block }: { block: ContentBlock }) => {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((block.type === 'decklist' || block.type === 'card_spotlight') && block.printingIds) {
      const fetchCardData = async () => {
        setLoading(true);
        try {
          const query = new URLSearchParams({ printingIds: block.printingIds!.join(',') });
          const response = await fetch(`/api/printings/search?${query.toString()}`);
          const data = await response.json();
          if (data.success) {
            setCards(data.data.printings);
          }
        } catch (error) {
          console.error("Failed to fetch card data for content block", error);
        } finally {
          setLoading(false);
        }
      };
      fetchCardData();
    }
  }, [block]);

  switch (block.type) {
    case 'heading':
      return <h3 className="text-2xl font-bold mt-8 mb-4 text-primary-foreground">{block.title}</h3>;
    
    case 'paragraph':
      return <p className="text-lg text-muted-foreground leading-relaxed mb-6">{block.text}</p>;

    case 'card_spotlight':
    case 'decklist':
      return (
        <Card className="bg-card/50 border-border mb-8">
          <CardHeader>
            <CardTitle>{block.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {block.text && <p className="text-muted-foreground mb-6">{block.text}</p>}
            {loading ? (
              <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className={`grid gap-4 ${block.type === 'card_spotlight' ? 'max-w-xs' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {cards.map(card => <PublicCardDisplay key={card.printing_id} card={card} />)}
              </div>
            )}
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
};


export const ContentRenderer: React.FC<ContentRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <div className="prose prose-invert lg:prose-xl max-w-none">
      {blocks.map((block, index) => (
        <ContentBlockDisplay key={index} block={block} />
      ))}
    </div>
  );
};