// components/deck/CardZoneExpanded.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Heart, RefreshCw, ArrowLeft, Trash2, X, CheckCircle, XCircle, AlertCircle, Plus, Minus, BookOpen } from "lucide-react";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { cn } from '@/lib/utils';

interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  printingDetails?: any;
}

interface CardZoneExpandedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  cards: (DeckPrinting & { category: string })[];
  onEdit?: (card: DeckPrinting & { category: string }) => void;
  onSwap?: (card: DeckPrinting & { category: string }) => void;
  onMove?: (card: DeckPrinting & { category: string }) => void;
  onRemove?: (card: DeckPrinting & { category: string }) => void;
  onAddToWants?: (card: DeckPrinting & { category: string }) => void;
  onRemoveFromWants?: (card: DeckPrinting & { category: string }) => void;
  onAddToBinder?: (card: DeckPrinting & { category: string }) => void;
  onRemoveFromBinder?: (card: DeckPrinting & { category: string }) => void;
  onToggleForTrade?: (card: DeckPrinting & { category: string }, forTrade: boolean) => void;
  editable?: boolean;
  deckId?: string;
  // Ownership status for each card (printingId -> { owned: number, needed: number, alternative?: number, forTrade?: boolean, inventoryItemIds?: string[], binderSlugs?: string[], binderNames?: string[], binderIds?: string[] })
  ownershipStatus?: Map<string, { owned: number; needed: number; alternative?: number; forTrade?: boolean; inventoryItemIds?: string[]; binderSlugs?: string[]; binderNames?: string[]; binderIds?: string[] }>;
  wantsMap?: Map<string, number>;
  deckCardCounts?: Map<string, number>;
  binderMap?: Map<string, { quantity: number; cardId: string }>;
}

export default function CardZoneExpanded({
  open,
  onOpenChange,
  title,
  cards,
  onEdit,
  onSwap,
  onMove,
  onRemove,
  onAddToWants,
  onRemoveFromWants,
  onAddToBinder,
  onRemoveFromBinder,
  onToggleForTrade,
  editable = false,
  deckId,
  ownershipStatus,
  wantsMap = new Map(),
  deckCardCounts = new Map(),
  binderMap = new Map()
}: CardZoneExpandedProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Helper to get ownership status for a card
  const getOwnershipInfo = (printingId: string) => {
    if (!ownershipStatus) return null;
    return ownershipStatus.get(printingId);
  };

  // Helper to get foiling info
  const getFoilingInfo = (foiling: string) => {
    const foilingMap = {
      'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
      'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
      'G': { name: 'Gold Foil', className: 'bg-yellow-500 text-black' },
      'S': { name: 'Non-foil', className: 'bg-gray-500 text-white' }
    };
    const code = foiling?.toUpperCase();
    return foilingMap[code] || { name: 'Non-foil', className: 'bg-gray-500 text-white' };
  };

  // Calculate optimal grid columns based on card count
  const getGridCols = () => {
    const count = cards.length;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 3) return 'grid-cols-3';
    if (count <= 4) return 'grid-cols-2 sm:grid-cols-4';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    // For many cards, use full responsive grid
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
  };

  // Calculate dialog width based on card count
  const getDialogWidth = () => {
    const count = cards.length;
    if (count === 1) return 'max-w-[400px]';
    if (count === 2) return 'max-w-[600px]';
    if (count <= 3) return 'max-w-[900px]';
    return 'max-w-[90vw]';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${getDialogWidth()} max-h-[90vh] overflow-hidden flex flex-col p-0`}>
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl font-bold">
            {title} ({cards.length} {cards.length === 1 ? 'card' : 'cards'})
          </DialogTitle>
        </DialogHeader>

        {/* Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {cards.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No cards in this zone
            </div>
          ) : (
            <div className="flex justify-center">
              <div className={`grid ${getGridCols()} gap-4`}>
                {cards.map((card, index) => {
                const imageUrl = card.printingDetails?.image_url || card.printingDetails?.image;
                const cardKey = card._id || `${card.printingId}-${index}`;
                const isHovered = hoveredCard === cardKey;
                const ownership = getOwnershipInfo(card.printingId);
                const wantedQty = wantsMap.get(card.printingId) || 0;
                const inDeckQty = deckCardCounts.get(card.printingId) || 0;
                const binderInfo = binderMap.get(card.printingId);
                const ownedQty = binderInfo?.quantity || 0;

                // Determine ownership status
                let ownershipBadge = null;
                if (ownership) {
                  if (ownership.owned >= ownership.needed) {
                    // Full ownership - have enough exact printings
                    ownershipBadge = (
                      <Badge className="bg-green-600 text-white border-0 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Own this version
                      </Badge>
                    );
                  } else if (ownership.owned > 0) {
                    // Partial ownership - have some exact printings but not enough
                    ownershipBadge = (
                      <Badge className="bg-yellow-600 text-white border-0 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Partial ({ownership.owned}/{ownership.needed})
                      </Badge>
                    );
                  } else if (ownership.alternative && ownership.alternative > 0) {
                    // Have alternative printings but not the exact one
                    ownershipBadge = (
                      <Badge className="bg-blue-600 text-white border-0 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        You own other versions
                      </Badge>
                    );
                  } else {
                    // Don't own any version of this card
                    ownershipBadge = (
                      <Badge className="bg-red-600 text-white border-0 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Do not own
                      </Badge>
                    );
                  }
                }

                return (
                  <div
                    key={cardKey}
                    className="relative group"
                    onMouseEnter={() => setHoveredCard(cardKey)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    {/* Card Image */}
                    <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-900 border-2 border-gray-700 hover:border-gray-500 transition-all relative">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={card.printingDetails?.name || card.printingDetails?.display_name || 'Card'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs p-2 text-center">
                          {card.printingDetails?.name || card.printingDetails?.display_name || 'Unknown Card'}
                        </div>
                      )}

                      {/* Ownership Badge at Top */}
                      {ownershipBadge && (
                        <div className="absolute top-2 left-2 right-2 flex justify-center">
                          {ownershipBadge}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons (show on hover) - 2x larger */}
                    {editable && (
                      <div className={`absolute bottom-2 left-0 right-0 flex flex-col gap-2 items-center transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                        {/* Action buttons row */}
                        <div className="flex gap-2 justify-center">
                          {/* Wants stack: + above - above heart */}
                          {onAddToWants && (
                            <div className="flex flex-col items-center gap-0.5">
                              {/* Reserve space for + button to keep heart at same height */}
                              {wantedQty > 0 ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-green-700"
                                  onClick={() => onAddToWants(card)}
                                  title="Want more"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              ) : (
                                <div className="h-6 w-6" />
                              )}
                              {/* Reserve space for - button to keep heart at same height */}
                              {onRemoveFromWants && wantedQty > 0 ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-red-700"
                                  onClick={() => onRemoveFromWants(card)}
                                  title="Want less"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              ) : (
                                <div className="h-6 w-6" />
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className={`h-12 w-12 p-0 ${wantedQty > 0 ? 'bg-pink-700 hover:bg-pink-600' : 'hover:bg-pink-700'}`}
                                onClick={() => onAddToWants(card)}
                                title={wantedQty > 0
                                  ? `Want ${wantedQty} of ${inDeckQty}`
                                  : "Add to wants"}
                              >
                                <Heart className={`h-5 w-5 ${wantedQty > 0 ? 'fill-current' : ''}`} />
                              </Button>
                            </div>
                          )}
                          {/* Binder stack: + above - above book */}
                          {onAddToBinder && (
                            <div className="flex flex-col items-center gap-0.5">
                              {/* Reserve space for + button to keep book at same height */}
                              {ownedQty > 0 ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-green-700"
                                  onClick={() => onAddToBinder(card)}
                                  title="Add more to binder"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              ) : (
                                <div className="h-6 w-6" />
                              )}
                              {/* Reserve space for - button to keep book at same height */}
                              {onRemoveFromBinder && ownedQty > 0 ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-red-700"
                                  onClick={() => onRemoveFromBinder(card)}
                                  title="Remove from binder"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              ) : (
                                <div className="h-6 w-6" />
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className={`h-12 w-12 p-0 ${ownedQty > 0 ? 'bg-blue-700 hover:bg-blue-600' : 'hover:bg-blue-700'}`}
                                onClick={() => onAddToBinder(card)}
                                title={ownedQty > 0
                                  ? `Have ${ownedQty} in binder`
                                  : "Add to binder"}
                              >
                                <BookOpen className={`h-5 w-5 ${ownedQty > 0 ? 'fill-current' : ''}`} />
                              </Button>
                            </div>
                          )}
                          {/* Move to inventory - with spacers to match height */}
                          {onMove && card.category !== 'hero' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="h-6 w-6" />
                              <div className="h-6 w-6" />
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-12 w-12 p-0"
                                onClick={() => onMove(card)}
                              >
                                <ArrowLeft className="h-5 w-5" />
                              </Button>
                            </div>
                          )}
                          {/* Delete - with spacers to match height */}
                          {onRemove && (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="h-6 w-6" />
                              <div className="h-6 w-6" />
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-12 w-12 p-0 hover:bg-red-700"
                                onClick={() => onRemove(card)}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Collector number, Rarity and Foiling info row */}
                        <div className="flex items-center gap-2 px-2">
                          {card.printingDetails?.printing_data?.id && (
                            <span className="uppercase tracking-wide text-white text-xs font-semibold bg-gray-900/90 px-2 py-1 rounded">
                              {card.printingDetails.printing_data.id}
                            </span>
                          )}
                          {card.printingDetails?.rarity && (
                            <RarityIcon rarityCode={card.printingDetails.rarity} size="sm" />
                          )}
                          {card.printingDetails?.foiling && (
                            <button
                              onClick={() => onSwap && onSwap(card)}
                              className={cn(
                                "text-xs px-3 py-1 rounded-full text-center transition-all",
                                getFoilingInfo(card.printingDetails.foiling).className,
                                onSwap ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                              )}
                              disabled={!onSwap}
                              title={onSwap ? "Click to change printing" : undefined}
                            >
                              {getFoilingInfo(card.printingDetails.foiling).name}
                            </button>
                          )}
                        </div>

                        {/* For Trade toggle — only when owned AND the endpoint
                            reported trade state (forTrade === undefined means
                            "unknown", so rendering the switch would misreport) */}
                        {onToggleForTrade && ownership && ownership.owned > 0 && ownership.forTrade !== undefined && (
                          <div className="flex items-center gap-2 px-2 pt-1">
                            <div className={cn(
                              "flex items-center gap-2 rounded-full px-3 py-1.5",
                              ownership.forTrade ? 'bg-green-700/90' : 'bg-gray-900/90'
                            )}>
                              <Switch
                                checked={!!ownership.forTrade}
                                onCheckedChange={(checked) => onToggleForTrade(card, checked)}
                                size="sm"
                              />
                              <span className={cn(
                                "text-xs font-medium",
                                ownership.forTrade ? 'text-white' : 'text-gray-300'
                              )}>
                                For Trade
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Binder location links - only show if user owns this card */}
                        {ownership && ownership.owned > 0 && ownership.binderSlugs && ownership.binderSlugs.length > 0 && (
                          <div className="flex items-center gap-2 px-2 pt-1 flex-wrap">
                            {ownership.binderSlugs.map((slug, idx) => {
                              const binderId = ownership.binderIds?.[idx];
                              return binderId ? (
                                <a
                                  key={idx}
                                  href={`/binder/${binderId}`}
                                  className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {slug}
                                </a>
                              ) : null;
                            })}
                          </div>
                        )}

                      </div>
                    )}

                    {/* Card Name Tooltip */}
                    {isHovered && card.printingDetails?.name && (
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700">
                        {card.printingDetails.display_name || card.printingDetails.name}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
