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
import { Input } from "@/components/ui/input";
import { Heart, RefreshCw, ArrowLeft, Trash2, X, CheckCircle, XCircle, AlertCircle, Plus, Minus, BookOpen, Tag } from "lucide-react";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { cn } from '@/lib/utils';

interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  printingDetails?: any;
  tags?: string[];
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
  onUpdateTags?: (card: DeckPrinting & { category: string }, tags: string[]) => void;
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
  onUpdateTags,
  editable = false,
  deckId,
  ownershipStatus,
  wantsMap = new Map(),
  deckCardCounts = new Map(),
  binderMap = new Map()
}: CardZoneExpandedProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [editingTags, setEditingTags] = useState<{cardKey: string, tags: string[]} | null>(null);
  const [newTagInput, setNewTagInput] = useState("");

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

  // Collect all unique tags from all cards
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    cards.forEach(card => {
      card.tags?.forEach(tag => tagSet.add(tag));
    });
    const tags = Array.from(tagSet).sort();
    console.log('[CardZoneExpanded] All tags:', tags, 'from', cards.length, 'cards');
    return tags;
  }, [cards]);

  // Filter cards based on selected tags
  const filteredCards = useMemo(() => {
    if (selectedTags.size === 0) return cards;

    return cards.filter(card => {
      if (!card.tags || card.tags.length === 0) return false;
      // Card must have at least one of the selected tags
      return card.tags.some(tag => selectedTags.has(tag));
    });
  }, [cards, selectedTags]);

  // Toggle tag selection for filtering
  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // Handle updating tags for a card
  const handleUpdateTags = async (card: DeckPrinting & { category: string }, tags: string[]) => {
    console.log('[CardZoneExpanded][handleUpdateTags] Called with tags:', tags);
    console.log('[CardZoneExpanded][handleUpdateTags] Card:', card.printingId, 'Category:', card.category);

    if (!deckId) {
      console.error('[CardZoneExpanded][handleUpdateTags] No deckId provided!');
      return;
    }

    try {
      const payload = {
        printingId: card.printingId,
        category: card.category,
        tags,
        action: 'set'
      };
      console.log('[CardZoneExpanded][handleUpdateTags] Sending payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`/api/decks/${deckId}/printings/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('[CardZoneExpanded][handleUpdateTags] Response status:', response.status);

      if (!response.ok) {
        console.error('[CardZoneExpanded][handleUpdateTags] Failed to update tags, status:', response.status);
        return;
      }

      const result = await response.json();
      console.log('[CardZoneExpanded][handleUpdateTags] Response data:', result);

      // Call parent handler to refresh deck data
      if (onUpdateTags) {
        console.log('[CardZoneExpanded][handleUpdateTags] Calling onUpdateTags handler');
        onUpdateTags(card, tags);
      }
    } catch (error) {
      console.error('[CardZoneExpanded][handleUpdateTags] Error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${getDialogWidth()} max-h-[90vh] overflow-hidden flex flex-col p-0`}>
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl font-bold">
            {title} ({filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'}{selectedTags.size > 0 ? ` / ${cards.length} total` : ''})
          </DialogTitle>

          {/* Tag Filter Chips */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Filter by tags:
              </span>
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.has(tag) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedTags.has(tag)
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "hover:bg-gray-700"
                  )}
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </Badge>
              ))}
              {selectedTags.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelectedTags(new Set())}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {cards.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No cards in this zone
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <p>No cards match the selected tags</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTags(new Set())}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className={`grid ${getGridCols()} gap-4`}>
                {filteredCards.map((card, index) => {
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

                        {/* For Trade toggle - only show if user owns this card */}
                        {onToggleForTrade && ownership && ownership.owned > 0 && (
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

                        {/* Card Tags - editable if deck is editable */}
                        {editable && deckId && (
                          <div className="flex flex-col gap-1 px-2 pt-1">
                            {editingTags?.cardKey === cardKey ? (
                              // Tag editing mode
                              <div className="bg-gray-900/90 rounded p-2 space-y-2">
                                <div className="text-xs text-yellow-400 mb-1">
                                  Debug: {editingTags.tags.length} tags - [{editingTags.tags.join(', ')}]
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {editingTags.tags.map((tag, tagIdx) => (
                                    <Badge
                                      key={tagIdx}
                                      variant="secondary"
                                      className="text-xs flex items-center gap-1 bg-purple-700 hover:bg-purple-600"
                                    >
                                      {tag}
                                      <X
                                        className="h-3 w-3 cursor-pointer"
                                        onClick={() => {
                                          // Use functional update to avoid stale state
                                          setEditingTags(currentState => {
                                            if (!currentState) return null;
                                            const newTags = currentState.tags.filter((_, i) => i !== tagIdx);
                                            return { ...currentState, tags: newTags };
                                          });
                                        }}
                                      />
                                    </Badge>
                                  ))}
                                </div>
                                <div className="flex gap-1">
                                  <Input
                                    type="text"
                                    placeholder="Add tag..."
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      // Debug: Check if ANY key is detected
                                      if (e.key === 'Enter') {
                                        e.preventDefault();

                                        const inputValue = newTagInput.trim();
                                        alert(`Enter pressed! Input value: "${inputValue}" (length: ${inputValue.length})`);

                                        if (!inputValue) {
                                          alert('Input is empty, not adding tag');
                                          return;
                                        }

                                        const trimmedTag = inputValue;
                                        console.log('[CardZoneExpanded] Adding tag:', trimmedTag);

                                        // Use functional update to avoid stale state
                                        setEditingTags(currentState => {
                                          alert(`Current state: ${currentState ? JSON.stringify(currentState.tags) : 'null'}`);

                                          if (!currentState) {
                                            alert('Current state is null!');
                                            return null;
                                          }

                                          // Prevent duplicates using the most up-to-date tags array
                                          if (!currentState.tags.includes(trimmedTag)) {
                                            const newTags = [...currentState.tags, trimmedTag];
                                            alert(`Adding tag! New tags: ${JSON.stringify(newTags)}`);
                                            console.log('[CardZoneExpanded] New tags array:', newTags);
                                            return { ...currentState, tags: newTags };
                                          }

                                          alert('Tag already exists!');
                                          console.log('[CardZoneExpanded] Tag already exists, skipping');
                                          return currentState;
                                        });

                                        setNewTagInput('');
                                      }
                                    }}
                                    className="h-6 text-xs bg-gray-800 border-gray-700"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-green-700 hover:bg-green-600"
                                    onClick={async () => {
                                      console.log('[CardZoneExpanded] Save button clicked!');
                                      console.log('[CardZoneExpanded] editingTags state:', editingTags);
                                      console.log('[CardZoneExpanded] Saving tags:', editingTags?.tags, 'for card:', card.printingId);
                                      if (!editingTags) {
                                        console.error('[CardZoneExpanded] editingTags is null!');
                                        return;
                                      }
                                      await handleUpdateTags(card, editingTags.tags);
                                      // DO NOT mutate props directly - let the parent handle state updates via onUpdateTags
                                      setEditingTags(null);
                                      setNewTagInput('');
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => {
                                      setEditingTags(null);
                                      setNewTagInput('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // Tag display mode
                              <div className="flex flex-wrap gap-1 items-center">
                                {card.tags && card.tags.length > 0 ? (
                                  card.tags.map((tag, tagIdx) => (
                                    <Badge
                                      key={tagIdx}
                                      variant="secondary"
                                      className="text-xs bg-purple-700 hover:bg-purple-600"
                                    >
                                      {tag}
                                    </Badge>
                                  ))
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 bg-gray-900/80 hover:bg-purple-700"
                                  onClick={() => {
                                    console.log('[CardZoneExpanded][Tag Icon Click] Opening editor for card:', card.printingId);
                                    console.log('[CardZoneExpanded][Tag Icon Click] Current card.tags:', card.tags);
                                    console.log('[CardZoneExpanded][Tag Icon Click] cardKey:', cardKey);
                                    const initialTags = card.tags || [];
                                    console.log('[CardZoneExpanded][Tag Icon Click] Setting editingTags to:', { cardKey, tags: initialTags });
                                    setEditingTags({
                                      cardKey,
                                      tags: initialTags
                                    });
                                  }}
                                  title="Edit tags"
                                >
                                  <Tag className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
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
