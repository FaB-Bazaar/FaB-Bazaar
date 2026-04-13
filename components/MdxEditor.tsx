"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Search, Info } from 'lucide-react';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';
import { Card, CardContent } from '@/components/ui/card';

interface MdxEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  rows?: number;
}

export function MdxEditor({ value, onChange, rows = 15 }: MdxEditorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [insertedCards, setInsertedCards] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Map codes to display names for preview
  const getDisplayInfo = (printing: any) => {
    const foilingMap: Record<string, string> = {
      's': 'NF',  // Standard/Normal
      'r': 'RF',  // Rainbow Foil
      'c': 'CF',  // Cold Foil
      'g': 'GF'   // Gold Foil
    };
    
    const editionMap: Record<string, string> = {
      'n': 'Normal',
      'f': '1st Edition',
      'u': 'Unlimited',
      'a': 'Alpha'
    };
    
    const foiling = foilingMap[printing.foiling] || printing.foiling?.toUpperCase() || 'Unknown';
    const edition = editionMap[printing.edition] || printing.edition?.toUpperCase() || 'Unknown';
    const setCode = printing.collector_number || printing.set?.toUpperCase() || 'Unknown';
    const price = printing.tcg_market ? `${Number(printing.tcg_market).toFixed(2)}` : 'No price';
    
    return {
      foiling,
      edition,
      setCode,
      price,
      fullDisplay: `${setCode} ${edition} ${foiling} (${price})`
    };
  };

  // Format card details for text insertion
  const formatCardDetailsForText = (printing: any) => {
    const details = [];
    
    // Get display info
    const displayInfo = getDisplayInfo(printing);
    
    // Add edition if not Normal (skip Normal edition)
    if (displayInfo.edition && displayInfo.edition !== 'Normal' && displayInfo.edition !== 'Unknown') {
      details.push(displayInfo.edition);
    }
    
    // Add foiling (always show foiling since NF is important)
    if (displayInfo.foiling && displayInfo.foiling !== 'Unknown') {
      details.push(displayInfo.foiling);
    }
    
    // Add set code
    if (displayInfo.setCode !== 'Unknown') {
      details.push(displayInfo.setCode);
    }
    
    return details.length > 0 ? ` ${details.join(', ')}` : '';
  };

  const handleCardSelect = (selection: any) => {
    const { card, printing } = selection;
    const printingId = printing.printing_id || printing.unique_id;
    const cardName = card.display_name || card.name || 'Unknown Card';

    if (!printingId) {
      console.error("No printingId found in selection");
      return;
    }

    // Add the selected card to the list
    const newCardEntry = {
      card,
      printing,
      displayInfo: getDisplayInfo(printing),
      timestamp: Date.now()
    };
    
    setInsertedCards(prev => [newCardEntry, ...prev]);

    // Format the card details for text insertion
    const cardDetails = formatCardDetailsForText(printing);

    const textToInsert = `**<InlineCard printingId="${printingId}">${cardName}</InlineCard>**${cardDetails}`;
    insertTextAtCursor(textToInsert);
    setIsSearchOpen(false);
  };

  // Helper function to insert text at the cursor's position
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

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-muted-foreground">Content Editor</h4>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="h-4 w-4 mr-2" />
          Insert Card Component
        </Button>
      </div>

      {/* Show list of inserted cards */}
      {insertedCards.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Cards inserted in this section ({insertedCards.length}):
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInsertedCards([])}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                Clear list
              </Button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {insertedCards.map((cardEntry, index) => (
                <div key={`${cardEntry.printing.printing_id}-${cardEntry.timestamp}`} className="flex items-start gap-3 p-2 bg-white dark:bg-slate-800 rounded border">
                  {cardEntry.printing.image_url && (
                    <img 
                      src={cardEntry.printing.image_url} 
                      alt={cardEntry.card.display_name}
                      className="w-8 h-10 object-cover rounded border flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">
                      {cardEntry.card.display_name}
                    </div>
                    <div className="text-xs font-mono text-blue-700 dark:text-blue-300">
                      {cardEntry.displayInfo.fullDisplay}
                    </div>
                    <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
                      ID: {cardEntry.printing.printing_id}
                    </div>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 flex-shrink-0">
                    #{insertedCards.length - index}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="font-mono text-sm"
        placeholder="Write your Markdown/MDX content here...&#10;&#10;Examples:&#10;- **<InlineCard printingId=&quot;abc123&quot;>Card Name</InlineCard>**&#10;- Regular markdown content&#10;- ## Headings and **bold text**"
      />
      
      <CardSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectCard={handleCardSelect}
      />
    </div>
  );
}