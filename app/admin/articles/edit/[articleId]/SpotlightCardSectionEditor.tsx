//app/admin/articles/edit/[articleId]/SpotlightCardSectionEditor.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';

interface SpotlightCardSectionEditorProps {
  section: {
    printingId: string;
    title?: string;
    commentary: string;
  };
  onChange: (updates: Partial<SpotlightCardSectionEditorProps['section']>) => void;
}

export function SpotlightCardSectionEditor({ section, onChange }: SpotlightCardSectionEditorProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [commentarySearchOpen, setCommentarySearchOpen] = useState(false);
  const [selectedCardName, setSelectedCardName] = useState<string>('');
  const [cardDetails, setCardDetails] = useState<any>(null);
  const commentaryTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch card details when printingId changes
  useEffect(() => {
    if (section.printingId && section.printingId !== 'undefined') {
      fetchCardDetails(section.printingId);
    }
  }, [section.printingId]);

  const fetchCardDetails = async (printingId: string) => {
    try {
      const response = await fetch(`/api/printings/search?printingIds=${printingId}&show=all`);
      const data = await response.json();
      if (data.success && data.data?.printings?.[0]) {
        const cardData = data.data.printings[0];
        setCardDetails(cardData);
        setSelectedCardName(cardData.name || cardData.display_name || 'Unknown Card');
      }
    } catch (error) {
      console.error('Failed to fetch card details:', error);
    }
  };

  const handleCardSelect = (selection: any) => {
    // Extract card data from the selection object that CardSearchDialog provides
    const { card, printing } = selection;
    const printingId = printing?.printing_id || printing?.unique_id;
    const cardName = card?.display_name || card?.name || 'Unknown Card';

    onChange({ printingId });
    setSelectedCardName(cardName);
    setSearchDialogOpen(false);

    // Fetch detailed card info for display
    if (printingId) {
      fetchCardDetails(printingId);
    }
  };

  // Handle card selection for commentary field
  const handleCommentaryCardSelect = (selection: any) => {
    const { card } = selection;
    const cardName = card?.display_name || card?.name || 'Unknown Card';

    // Insert card mention in markdown format: **Card Name**
    const textToInsert = `**${cardName}**`;
    insertTextAtCursor(textToInsert);
    setCommentarySearchOpen(false);
  };

  // Helper function to insert text at the cursor's position in commentary
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = commentaryTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = section.commentary || '';
      const newText =
        currentValue.substring(0, start) +
        textToInsert +
        currentValue.substring(end);

      onChange({ commentary: newText });

      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      }, 0);
    }
  };

  const getDisplayInfo = (card: any) => {
    if (!card) return null;

    // Map foiling codes to display names
    const foilingMap: Record<string, string> = {
      's': 'NF',  // Standard/Normal
      'r': 'RF',  // Rainbow Foil
      'c': 'CF',  // Cold Foil
      'g': 'GF',  // Gold Foil
    };

    const parts = [];

    // Add set abbreviation if available
    if (card.set) {
      parts.push(card.set.toUpperCase());
    }

    // Add foiling if not standard
    if (card.foiling && card.foiling !== 's') {
      const foiling = foilingMap[card.foiling.toLowerCase()] || card.foiling.toUpperCase();
      parts.push(foiling);
    }

    // Add edition if not normal
    if (card.edition && card.edition.toLowerCase() !== 'normal') {
      parts.push(card.edition);
    }

    return {
      fullDisplay: parts.length > 0 ? parts.join(' • ') : 'Standard'
    };
  };

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label className="font-semibold">Featured Card</Label>
        <div className="mt-1">
          {selectedCardName ? (
            <div className="flex items-center justify-between p-3 border rounded-md bg-background">
              <div className="flex-1">
                <p className="font-medium">{selectedCardName}</p>
                {cardDetails && (
                  <p className="text-sm text-muted-foreground font-mono">
                    {getDisplayInfo(cardDetails)?.fullDisplay}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">ID: {section.printingId}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchDialogOpen(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Change
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearchDialogOpen(true)}
              className="w-full"
            >
              <Search className="h-4 w-4 mr-2" />
              Select Card
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="title" className="font-semibold">Spotlight Title (Optional)</Label>
        <input
          id="title"
          type="text"
          value={section.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., 'Card of the Week', 'Strategy Spotlight', 'Hidden Gem'"
          className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leave blank to use the card name as the title
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <Label htmlFor="commentary" className="font-semibold">Commentary</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCommentarySearchOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Insert Card Mention
          </Button>
        </div>
        <textarea
          ref={commentaryTextareaRef}
          id="commentary"
          value={section.commentary || ''}
          onChange={(e) => onChange({ commentary: e.target.value })}
          placeholder="Write your analysis, strategy insights, or thoughts about this card...&#10;&#10;Supports markdown:&#10;- **Card Name** for card mentions&#10;- # Headings&#10;- Lists, links, code blocks, etc."
          rows={8}
          className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Supports markdown formatting. Use <strong>**Card Name**</strong> syntax for card mentions (click &quot;Insert Card Mention&quot; to search and insert).
        </p>
      </div>

      {/* Card Search Dialog - Main Spotlight Card */}
      <CardSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectCard={handleCardSelect}
      />

      {/* Card Search Dialog - Commentary Insertion */}
      <CardSearchDialog
        open={commentarySearchOpen}
        onOpenChange={setCommentarySearchOpen}
        onSelectCard={handleCommentaryCardSelect}
      />
    </div>
  );
}