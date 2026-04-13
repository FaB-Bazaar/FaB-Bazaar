//app/admin/articles/edit/[articleId]/OpportunityCardSectionEditor.tsx
"use client";

  // Import your constants at the top of the file
  import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import the existing search dialog from heroes
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';

interface OpportunityCardSectionEditorProps {
  section: {
    printingId: string;
    reason: 'underpriced' | 'trending' | 'supply-issue' | 'correction' | 'outlier';
    confidence: 'low' | 'medium' | 'high';
    priceChange?: {
      old: number;
      new: number;
      percentage: number;
    } | null;
    note: string;
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function OpportunityCardSectionEditor({ section, onChange }: OpportunityCardSectionEditorProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedCardName, setSelectedCardName] = useState<string>('');

  const handlePriceChangeToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        priceChange: {
          old: 0,
          new: 0,
          percentage: 0
        }
      });
    } else {
      onChange({ priceChange: null });
    }
  };

  const handlePriceChangeUpdate = (field: 'old' | 'new', value: number) => {
    if (!section.priceChange) return;
    
    const updatedPriceChange = { ...section.priceChange, [field]: value };
    
    // Auto-calculate percentage when old or new price changes
    if (field === 'old' || field === 'new') {
      const { old, new: newPrice } = updatedPriceChange;
      if (old > 0) {
        updatedPriceChange.percentage = ((newPrice - old) / old) * 100;
      }
    }
    
    onChange({ priceChange: updatedPriceChange });
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

  const [cardDetails, setCardDetails] = useState<any>(null);

  // Effect to fetch card details when printingId changes (manual entry)
  useEffect(() => {
    if (section.printingId && section.printingId !== cardDetails?.printing_id) {
      fetchCardDetails(section.printingId);
    }
  }, [section.printingId]);

  const fetchCardDetails = async (printingId: string) => {
    try {
      const response = await fetch(`/api/printings/search?printingIds=${printingId}&show=all`);
      const data = await response.json();
      if (data.success && data.data?.printings?.[0]) {
        setCardDetails(data.data.printings[0]);
      }
    } catch (error) {
      console.error('Failed to fetch card details:', error);
    }
  };

  // Import your constants at the top of the file
  const getDisplayInfo = (card: any) => {
    if (!card) return null;
    
    // Map foiling codes to display names
    const foilingMap: Record<string, string> = {
      's': 'NF',  // Standard/Normal
      'r': 'RF',  // Rainbow Foil
      'c': 'CF',  // Cold Foil
      'g': 'GF'   // Gold Foil
    };
    
    // Map edition codes
    const editionMap: Record<string, string> = {
      'n': 'Normal',
      'f': '1st Edition',
      'u': 'Unlimited',
      'a': 'Alpha'
    };
    
    const foiling = foilingMap[card.foiling] || card.foiling?.toUpperCase() || 'Unknown';
    const edition = editionMap[card.edition] || card.edition?.toUpperCase() || 'Unknown';
    const setCode = card.collector_number || card.set?.toUpperCase() || 'Unknown';
    const price = card.tcg_market ? `${Number(card.tcg_market).toFixed(2)}` : 'No price';
    
    return {
      foiling,
      edition,
      setCode,
      price,
      fullDisplay: `${setCode} ${edition} ${foiling} (${price})`
    };
  };

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label htmlFor="printingId" className="font-semibold">Card Selection</Label>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reason" className="font-semibold">Opportunity Type</Label>
          <Select value={section.reason || ''} onValueChange={(value: typeof section.reason) => onChange({ reason: value })}>
            <SelectTrigger id="reason" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="underpriced">Potential Buy (Underpriced)</SelectItem>
              <SelectItem value="trending">Trending Up</SelectItem>
              <SelectItem value="supply-issue">Supply Constraint</SelectItem>
              <SelectItem value="correction">Price Correction</SelectItem>
              <SelectItem value="outlier">Unusual Movement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="confidence" className="font-semibold">Confidence Level</Label>
          <Select value={section.confidence || ''} onValueChange={(value: typeof section.confidence) => onChange({ confidence: value })}>
            <SelectTrigger id="confidence" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includePriceChange"
            checked={section.priceChange !== null}
            onCheckedChange={handlePriceChangeToggle}
          />
          <Label htmlFor="includePriceChange" className="font-semibold">Include price change data</Label>
        </div>

        {section.priceChange && (
          <div className="grid grid-cols-3 gap-3 pl-6">
            <div>
              <Label htmlFor="oldPrice" className="font-semibold">Old Price ($)</Label>
              <Input
                id="oldPrice"
                type="number"
                step="0.01"
                value={section.priceChange?.old || ''}
                onChange={(e) => handlePriceChangeUpdate('old', parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="newPrice" className="font-semibold">New Price ($)</Label>
              <Input
                id="newPrice"
                type="number"
                step="0.01"
                value={section.priceChange?.new || ''}
                onChange={(e) => handlePriceChangeUpdate('new', parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="percentage" className="font-semibold">Change (%)</Label>
              <Input
                id="percentage"
                type="number"
                step="0.1"
                value={section.priceChange?.percentage?.toFixed(1) || ''}
                readOnly
                className="bg-muted mt-1"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="note" className="font-semibold">Editorial Note</Label>
        <Textarea
          id="note"
          value={section.note || ''}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Add context about why this is an opportunity or what's causing the price movement..."
          rows={3}
          className="mt-1"
        />
      </div>

      {/* Card Search Dialog */}
      <CardSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectCard={handleCardSelect}
      />
    </div>
  );
}
