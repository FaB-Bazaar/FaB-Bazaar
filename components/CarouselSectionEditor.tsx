// components/CarouselSectionEditor.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X, Plus } from 'lucide-react';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';

interface CarouselCard {
  printingId: string;
  caption?: string;
}

interface CarouselSectionEditorProps {
  cards: CarouselCard[];
  onChange: (cards: CarouselCard[]) => void;
}

interface CardDetails {
  printing_id: string;
  display_name: string;
  printing_card_id: string;
  foiling: string;
  edition: string;
  tcg_market?: number;
  image_url?: string;
}

export function CarouselSectionEditor({ cards, onChange }: CarouselSectionEditorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cardDetails, setCardDetails] = useState<Record<string, CardDetails>>({});

  // Map codes to display names
  const getDisplayInfo = (card: CardDetails) => {
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
    
    const foiling = foilingMap[card.foiling] || card.foiling?.toUpperCase() || 'Unknown';
    const edition = editionMap[card.edition] || card.edition?.toUpperCase() || 'Unknown';
    const setCode = card.printing_card_id || 'Unknown';
    const price = card.tcg_market ? `$${Number(card.tcg_market).toFixed(2)}` : 'No price';
    
    return {
      foiling,
      edition,
      setCode,
      price,
      fullDisplay: `${setCode} ${edition} ${foiling} (${price})`
    };
  };

  const fetchCardDetails = async (printingId: string) => {
    if (cardDetails[printingId]) return; // Already have details
    
    try {
      const response = await fetch(`/api/printings/search?printingIds=${printingId}&show=all`);
      const data = await response.json();
      if (data.success && data.data?.printings?.[0]) {
        setCardDetails(prev => ({
          ...prev,
          [printingId]: data.data.printings[0]
        }));
      }
    } catch (error) {
      console.error('Failed to fetch card details:', error);
    }
  };

  // Fetch details for all cards when component mounts or cards change
  useEffect(() => {
    cards.forEach(card => {
      if (card.printingId && !cardDetails[card.printingId]) {
        fetchCardDetails(card.printingId);
      }
    });
  }, [cards]);

  const handleAddCard = (selection: any) => {
    const { card, printing } = selection;
    const printingId = printing.printing_id || printing.unique_id;
    const cardName = card.display_name || card.name || 'Unknown Card';

    if (printingId && !cards.some(c => c.printingId === printingId)) {
      const newCard: CarouselCard = {
        printingId,
        caption: cardName
      };
      onChange([...cards, newCard]);
    }
    setIsSearchOpen(false);
  };

  const removeCard = (index: number) => {
    onChange(cards.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    const updated = [...cards];
    updated[index] = { ...updated[index], caption };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold">Carousel Cards ({cards.length})</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No cards added yet</p>
              <p className="text-sm">Click "Add Card" to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cards.map((card, index) => {
            const details = cardDetails[card.printingId];
            const displayInfo = details ? getDisplayInfo(details) : null;
            
            return (
              <Card key={`${card.printingId}-${index}`} className="p-3">
                <div className="flex items-start gap-3">
                  {/* Card Image */}
                  <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {details?.image_url ? (
                      <img 
                        src={details.image_url} 
                        alt={details.display_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-600 dark:text-gray-400">IMG</span>
                    )}
                  </div>

                  {/* Card Details */}
                  <div className="flex-1 space-y-2">
                    {/* Card Name and Details */}
                    <div>
                      <div className="font-medium text-sm">
                        {details?.display_name || 'Loading...'}
                      </div>
                      {displayInfo && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {displayInfo.fullDisplay}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground font-mono">
                        ID: {card.printingId}
                      </div>
                    </div>

                    {/* Caption Input */}
                    <div>
                      <Label htmlFor={`caption-${index}`} className="text-sm">Caption</Label>
                      <Input
                        id={`caption-${index}`}
                        value={card.caption || ''}
                        onChange={(e) => updateCaption(index, e.target.value)}
                        placeholder="Optional caption for this card"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCard(index)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CardSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectCard={handleAddCard}
      />
    </div>
  );
}
// // Create this as a new file: CarouselSectionEditor.tsx
// "use client";

// import React, { useState } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Search, X, Plus } from 'lucide-react';
// import CardSearchDialog from '@/components/card-search-dialog';

// interface CarouselCard {
//   printingId: string;
//   caption?: string;
// }

// interface CarouselSectionEditorProps {
//   cards: CarouselCard[];
//   onChange: (cards: CarouselCard[]) => void;
// }

// export function CarouselSectionEditor({ cards, onChange }: CarouselSectionEditorProps) {
//   const [isSearchOpen, setIsSearchOpen] = useState(false);

//   const handleAddCard = (selection: any) => {
//     const { card, printing } = selection;
//     const printingId = printing.printing_id || printing.unique_id;
//     const cardName = card.display_name || card.name || 'Unknown Card';

//     if (printingId && !cards.some(c => c.printingId === printingId)) {
//       const newCard: CarouselCard = {
//         printingId,
//         caption: cardName
//       };
//       onChange([...cards, newCard]);
//     }
//     setIsSearchOpen(false);
//   };

//   const removeCard = (index: number) => {
//     onChange(cards.filter((_, i) => i !== index));
//   };

//   const updateCaption = (index: number, caption: string) => {
//     const updated = [...cards];
//     updated[index] = { ...updated[index], caption };
//     onChange(updated);
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <Label className="text-base font-semibold">Carousel Cards ({cards.length})</Label>
//         <Button 
//           type="button" 
//           variant="outline" 
//           size="sm"
//           onClick={() => setIsSearchOpen(true)}
//         >
//           <Search className="h-4 w-4 mr-2" />
//           Add Card
//         </Button>
//       </div>

//       {cards.length === 0 ? (
//         <Card className="border-dashed">
//           <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
//             <div className="text-center">
//               <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
//               <p>No cards added yet</p>
//               <p className="text-sm">Click "Add Card" to get started</p>
//             </div>
//           </CardContent>
//         </Card>
//       ) : (
//         <div className="grid gap-3">
//           {cards.map((card, index) => (
//             <Card key={`${card.printingId}-${index}`} className="p-3">
//               <div className="flex items-start gap-3">
//                 <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded border flex items-center justify-center flex-shrink-0">
//                   <span className="text-xs text-gray-600 dark:text-gray-400">IMG</span>
//                 </div>
//                 <div className="flex-1 space-y-2">
//                   <div className="text-sm font-mono text-muted-foreground">
//                     {card.printingId}
//                   </div>
//                   <div>
//                     <Label htmlFor={`caption-${index}`} className="text-sm">Caption</Label>
//                     <Input
//                       id={`caption-${index}`}
//                       value={card.caption || ''}
//                       onChange={(e) => updateCaption(index, e.target.value)}
//                       placeholder="Optional caption for this card"
//                       className="mt-1"
//                     />
//                   </div>
//                 </div>
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="icon"
//                   onClick={() => removeCard(index)}
//                   className="text-destructive hover:text-destructive/80"
//                 >
//                   <X className="h-4 w-4" />
//                 </Button>
//               </div>
//             </Card>
//           ))}
//         </div>
//       )}

//       <CardSearchDialog
//         open={isSearchOpen}
//         onOpenChange={setIsSearchOpen}
//         onSelectCard={handleAddCard}
//       />
//     </div>
//   );
// }