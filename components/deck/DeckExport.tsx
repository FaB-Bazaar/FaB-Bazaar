// components/deck/DeckExport.tsx - Updated for new printings data model
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Copy, 
  Download, 
  Share2, 
  FileText,
  Code,
  Image
} from "lucide-react";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;
  condition?: string;
  notes?: string;
  addedAt: string;
  printingDetails?: {
    name: string;
    display_name: string;
    card_unique_id: string;
    set_id?: string;
    set?: string;
    [key: string]: any;
  };
}

interface DeckExportProps {
  deck: {
    _id: string;
    publicId?: string;
    name: string;
    description?: string;
    format: string;
    heroName?: string;
    hero?: DeckPrinting[];
    equipment?: DeckPrinting[];
    maindeck?: DeckPrinting[];
    inventory?: DeckPrinting[];
  };
  onCopyList: () => void;
}

// Helper function to group printings by card name and category
interface CardEntry {
  name: string;
  quantity: number;
  category: string;
  set?: string;
  cardId: string;
}

export default function DeckExport({ deck, onCopyList }: DeckExportProps) {
  const [exportFormat, setExportFormat] = useState<'text' | 'json' | 'csv'>('text');
  const [copied, setCopied] = useState(false);

  // Flatten categorized arrays into a single list of CardEntry
  const groupPrintingsByCard = (): CardEntry[] => {
    const categories: Array<{ key: string; items: DeckPrinting[] }> = [
      { key: 'hero', items: deck.hero || [] },
      { key: 'equipment', items: deck.equipment || [] },
      { key: 'main', items: deck.maindeck || [] },
      { key: 'sideboard', items: deck.inventory || [] },
    ];

    const grouped: Record<string, CardEntry> = {};

    categories.forEach(({ key, items }) => {
      items.forEach(printing => {
        const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || `Card ${printing.printingId}`;
        const cardId = printing.printingDetails?.card_unique_id || printing.printingId;
        const set = printing.printingDetails?.set_id || printing.printingDetails?.set;
        const entryKey = `${key}-${cardId}`;

        if (!grouped[entryKey]) {
          grouped[entryKey] = {
            name: cardName,
            quantity: 0,
            category: key,
            set,
            cardId
          };
        }
        grouped[entryKey].quantity += printing.quantity || 1;
      });
    });

    return Object.values(grouped);
  };

  // Generate different export formats
  const generateTextList = () => {
    const cards = groupPrintingsByCard();
    const sections = {
      hero: cards.filter(c => c.category === 'hero'),
      equipment: cards.filter(c => c.category === 'equipment'),
      main: cards.filter(c => c.category === 'main'),
      sideboard: cards.filter(c => c.category === 'sideboard')
    };

    let output = `${deck.name}\n`;
    if (deck.heroName) output += `Hero: ${deck.heroName}\n`;
    output += `Format: ${deck.format}\n\n`;

    Object.entries(sections).forEach(([category, cards]) => {
      if (cards.length > 0) {
        output += `${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
        cards.forEach(card => {
          output += `${card.quantity}x ${card.name}${card.set ? ` (${card.set})` : ''}\n`;
        });
        output += '\n';
      }
    });

    return output.trim();
  };

  const generateJSONExport = () => {
    const cards = groupPrintingsByCard();
    return JSON.stringify({
      name: deck.name,
      description: deck.description,
      format: deck.format,
      hero: deck.heroName,
      cards: cards.map(card => ({
        name: card.name,
        quantity: card.quantity,
        category: card.category,
        set: card.set
      }))
    }, null, 2);
  };

  const generateCSVExport = () => {
    const cards = groupPrintingsByCard();
    let csv = 'Name,Quantity,Category,Set\n';
    cards.forEach(card => {
      csv += `"${card.name}",${card.quantity},"${card.category}","${card.set || ''}"\n`;
    });
    return csv;
  };

  const getExportContent = () => {
    switch (exportFormat) {
      case 'json':
        return generateJSONExport();
      case 'csv':
        return generateCSVExport();
      default:
        return generateTextList();
    }
  };

  const handleCopy = async (content?: string) => {
    try {
      const textToCopy = content || getExportContent();
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (!content) onCopyList(); // Only call the prop callback for the main copy action
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownload = () => {
    const content = getExportContent();
    const filename = `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.${exportFormat}`;
    const blob = new Blob([content], { 
      type: exportFormat === 'json' ? 'application/json' : 
           exportFormat === 'csv' ? 'text/csv' : 
           'text/plain' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateShareableLink = () => {
    // This would typically generate a shareable link to the deck
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/decks/${deck.publicId || deck._id}`;
  };

  const handleShare = async () => {
    const shareUrl = generateShareableLink();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: deck.name,
          text: `Check out my ${deck.format} deck: ${deck.name}`,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
        handleCopy(shareUrl);
      }
    } else {
      handleCopy(shareUrl);
    }
  };

  // Calculate stats from categorized arrays
  const sumQty = (items: DeckPrinting[] = []) => items.reduce((s, c) => s + (c.quantity || 1), 0);
  const deckStats = {
    totalCards: sumQty(deck.hero) + sumQty(deck.equipment) + sumQty(deck.maindeck) + sumQty(deck.inventory),
    uniqueCards: groupPrintingsByCard().length,
    mainDeck: sumQty(deck.maindeck),
    equipment: sumQty(deck.equipment),
    sideboard: sumQty(deck.inventory),
    heroes: sumQty(deck.hero)
  };

  return (
    <div className="space-y-6">
      {/* Export Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={exportFormat === 'text' ? 'default' : 'outline'}
              onClick={() => setExportFormat('text')}
              size="sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              Text
            </Button>
            <Button
              variant={exportFormat === 'json' ? 'default' : 'outline'}
              onClick={() => setExportFormat('json')}
              size="sm"
            >
              <Code className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button
              variant={exportFormat === 'csv' ? 'default' : 'outline'}
              onClick={() => setExportFormat('csv')}
              size="sm"
            >
              <Image className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>

          <div className="space-y-4">
            <Textarea
              value={getExportContent()}
              readOnly
              rows={12}
              className="font-mono text-sm"
              placeholder="Deck export will appear here..."
            />

            <div className="flex gap-2">
              <Button
                onClick={() => handleCopy()}
                className="flex-1"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
              
              <Button
                onClick={handleDownload}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Simple Text List */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium">Simple Card List</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Basic quantity and name format
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const cards = groupPrintingsByCard();
                  const simpleList = cards.map(card => 
                    `${card.quantity}x ${card.name}`
                  ).join('\n');
                  handleCopy(simpleList);
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>

            {/* Tournament Format */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium">Tournament Format</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Organized by category for tournaments
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(generateTextList())}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>

            {/* Share Link */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium">Share Deck</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Share a link to this deck
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deck Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Deck Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Cards:</span>
              <span className="ml-2 font-medium">{deckStats.totalCards}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Unique Cards:</span>
              <span className="ml-2 font-medium">{deckStats.uniqueCards}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Main Deck:</span>
              <span className="ml-2 font-medium">{deckStats.mainDeck}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Equipment:</span>
              <span className="ml-2 font-medium">{deckStats.equipment}</span>
            </div>
            {deckStats.heroes > 0 && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Heroes:</span>
                <span className="ml-2 font-medium">{deckStats.heroes}</span>
              </div>
            )}
            {deckStats.sideboard > 0 && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Sideboard:</span>
                <span className="ml-2 font-medium">{deckStats.sideboard}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}