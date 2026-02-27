"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Search, Grid3X3, Plus } from 'lucide-react';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';

interface MdxEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  rows?: number;
}

export function MdxEditor({ value, onChange, rows = 15 }: MdxEditorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract essential card metadata from selection
  const extractCardMetadata = (selection: any) => {
    const { card, printing } = selection;
    return {
      printingId: printing.printing_id || printing.unique_id,
      cardName: card.display_name || card.name || 'Unknown Card',
    };
  };

  // Handle single card insertion
  const handleCardSelect = (selection: any) => {
    const metadata = extractCardMetadata(selection);

    if (isCarouselMode) {
      // Add to carousel selection
      if (metadata.printingId && !selectedCards.some(c => c.printingId === metadata.printingId)) {
        setSelectedCards(prev => [...prev, metadata]);
      }
    } else {
      // Insert inline card - simplified to just printingId and name
      if (!metadata.printingId) {
        console.error("No printingId found in selection");
        return;
      }

      const textToInsert = `<InlineCard printingId="${metadata.printingId}">${metadata.cardName}</InlineCard>`;
      insertTextAtCursor(textToInsert);
      setIsSearchOpen(false);
    }
  };

  // Helper function to insert text at cursor position
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = 
        textarea.value.substring(0, start) + 
        textToInsert + 
        textarea.value.substring(end);
      
      onChange(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      }, 0);
    }
  };

  // Start carousel mode
  const startCarouselMode = () => {
    setIsCarouselMode(true);
    setSelectedCards([]);
    setIsSearchOpen(true);
  };

  // Finish carousel and insert MDX
  const finishCarousel = () => {
    if (selectedCards.length === 0) {
      setIsCarouselMode(false);
      setIsSearchOpen(false);
      return;
    }

    // Generate the CardCarousel MDX - simplified to just printingId
    const carouselContent = selectedCards
      .map(card => `  <HeroCard printingId="${card.printingId}" />`)
      .join('\n');

    const textToInsert = `\n<CardCarousel>\n${carouselContent}\n</CardCarousel>\n`;

    insertTextAtCursor(textToInsert);

    // Reset state
    setIsCarouselMode(false);
    setSelectedCards([]);
    setIsSearchOpen(false);
  };

  // Cancel carousel mode
  const cancelCarousel = () => {
    setIsCarouselMode(false);
    setSelectedCards([]);
    setIsSearchOpen(false);
  };

  // Remove card from carousel selection
  const removeCardFromCarousel = (printingId: string) => {
    setSelectedCards(prev => prev.filter(card => card.printingId !== printingId));
  };

  // Helper to display card name in selection
  const getCardDisplayText = (card: any) => card.cardName;

  return (
    <div>
      <div className="flex justify-end gap-2 mb-2">
        {!isCarouselMode ? (
          <>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4 mr-2" />
              Insert Card Component
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={startCarouselMode}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Insert Card Carousel
            </Button>
          </>
        ) : (
          <>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={finishCarousel}
              disabled={selectedCards.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Insert Carousel ({selectedCards.length} cards)
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={cancelCarousel}
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Show selected cards in carousel mode with enhanced details */}
      {isCarouselMode && selectedCards.length > 0 && (
        <div className="mb-4 p-3 border rounded-lg bg-muted/50">
          <h4 className="text-sm font-semibold mb-2">Selected Cards for Carousel:</h4>
          <div className="flex flex-wrap gap-2">
            {selectedCards.map((card, index) => (
              <div key={card.printingId} className="flex items-center gap-2 px-2 py-1 bg-background border rounded text-sm">
                <span>{getCardDisplayText(card)}</span>
                <button
                  type="button"
                  onClick={() => removeCardFromCarousel(card.printingId)}
                  className="text-destructive hover:text-destructive/80 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="font-mono text-sm"
        placeholder="Write your Markdown/MDX content here..."
      />
      
      <CardSearchDialog
        open={isSearchOpen}
        onOpenChange={(open) => {
          if (!open && !isCarouselMode) {
            setIsSearchOpen(false);
          }
        }}
        onSelectCard={handleCardSelect}
      />
    </div>
  );
}
