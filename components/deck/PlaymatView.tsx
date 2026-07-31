// components/deck/PlaymatView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Shuffle,
  Search,
  Heart,
  Trash2,
  ArrowLeftRight,
  Eye,
  ArrowLeft,
  Minus,
  Plus,
  BookOpen,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CardZoneExpanded from "./CardZoneExpanded";
import { decksClient } from "@/lib/client";
import { buildOwnershipMap } from "@/lib/deck/ownership-map";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  printingDetails?: any;
}

interface PlaymatViewProps {
  deck: {
    _id?: string;
    name?: string;
    hero: DeckPrinting[];
    equipment: DeckPrinting[];
    maindeck: DeckPrinting[];
    inventory: DeckPrinting[];
    tokens?: DeckPrinting[];
    maybeboard?: DeckPrinting[];
  };
  onZoneClick: (zone: string) => void;
  onShuffle?: () => void;
  onSearch?: () => void;
  onEdit?: (card: DeckPrinting & { category: string }) => void;
  onSwap?: (card: DeckPrinting & { category: string }) => void;
  onMove?: (card: DeckPrinting & { category: string }) => void;
  onRemove?: (card: DeckPrinting & { category: string }) => void;
  onAddCard?: (category: string) => void;
  onAddToWants?: (card: DeckPrinting & { category: string }) => void;
  onRemoveFromWants?: (card: DeckPrinting & { category: string }) => void;
  onAddToBinder?: (card: DeckPrinting & { category: string }) => void;
  onRemoveFromBinder?: (card: DeckPrinting & { category: string }) => void;
  onToggleForTrade?: (card: DeckPrinting & { category: string }, forTrade: boolean) => void;
  editable?: boolean;
  ownershipRefreshKey?: number;
  wantsMap?: Map<string, number>;
  deckCardCounts?: Map<string, number>;
  binderMap?: Map<string, { quantity: number; cardId: string }>;
}

function CardZone({
  title,
  count,
  onClick,
  onContextMenu,
  isEmpty = false,
  highlight = false,
  children,
  actions
}: {
  title: string;
  count: number;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isEmpty?: boolean;
  highlight?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        relative bg-gray-800/40 rounded-lg border-2 transition-all duration-200 h-full
        ${isEmpty ? 'border-gray-700/30 border-dashed' : 'border-gray-600/50'}
        ${highlight ? 'border-blue-500 shadow-lg shadow-blue-500/20' : ''}
        ${onClick ? 'cursor-pointer hover:border-gray-500 hover:bg-gray-800/60' : ''}
        backdrop-blur-sm
      `}
    >
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
        <Badge variant="secondary" className="text-xs bg-gray-900/80 backdrop-blur-sm">
          {title} {count > 0 && `(${count})`}
        </Badge>
        {actions && (
          <div className="flex gap-1">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function CardStackPreview({ cards, maxVisible = 3 }: { cards: DeckPrinting[]; maxVisible?: number }) {
  if (cards.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
        Empty
      </div>
    );
  }

  const visibleCards = cards.slice(0, maxVisible);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      {visibleCards.map((card, index) => (
        <div
          key={card._id || `${card.printingId}-${index}`}
          className="absolute rounded-md bg-gray-900 border border-gray-700 shadow-xl"
          style={{
            width: '120px',
            height: '168px',
            transform: `translate(${index * 4}px, ${index * 4}px)`,
            zIndex: index,
          }}
        >
          {card.printingDetails?.image_url || card.printingDetails?.image ? (
            <img
              src={card.printingDetails.image_url || card.printingDetails.image}
              alt={card.printingDetails?.name || card.printingDetails?.display_name || 'Card'}
              className="w-full h-full object-cover rounded-md"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs p-2 text-center">
              {card.printingDetails?.name || card.printingDetails?.display_name || 'Card'}
            </div>
          )}
        </div>
      ))}
      {cards.length > maxVisible && (
        <div
          className="absolute rounded-md bg-gray-800 border border-gray-600 shadow-xl flex items-center justify-center text-white font-bold"
          style={{
            width: '120px',
            height: '168px',
            transform: `translate(${maxVisible * 4}px, ${maxVisible * 4}px)`,
            zIndex: maxVisible,
          }}
        >
          +{cards.length - maxVisible}
        </div>
      )}
    </div>
  );
}

function SingleCard({
  card,
  label,
  onEdit,
  onSwap,
  onMove,
  onRemove,
  onAdd,
  onAddToBinder,
  onRemoveFromBinder,
  onRemoveFromWants,
  category,
  wantsInfo,
  binderInfo
}: {
  card?: DeckPrinting;
  label: string;
  onEdit?: () => void;
  onSwap?: () => void;
  onMove?: () => void;
  onRemove?: () => void;
  onRemoveFromWants?: () => void;
  onAddToBinder?: () => void;
  onRemoveFromBinder?: () => void;
  onAdd?: () => void;
  category?: string;
  wantsInfo?: { wanted: number; inDeck: number };
  binderInfo?: { owned: number; inDeck: number };
}) {
  if (!card) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`w-full h-full rounded-lg border-2 border-dashed border-gray-700/50 flex items-center justify-center text-gray-600 text-xs ${
            onAdd ? 'cursor-pointer hover:border-gray-500 hover:bg-gray-800/30 transition-colors' : ''
          }`}
          onClick={(e) => {
            if (onAdd) {
              e.stopPropagation();
              onAdd();
            }
          }}
        >
          {label}
        </div>
      </div>
    );
  }

  // Get image URL from printingDetails
  const imageUrl = card.printingDetails?.image_url || card.printingDetails?.image;

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="flex-1 flex items-center justify-center relative group">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.printingDetails?.name || card.printingDetails?.display_name || label}
            className="w-full h-full object-contain rounded-lg shadow-2xl"
            onError={(e) => {
              console.error('Failed to load card image:', imageUrl, card.printingDetails);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-400 text-sm p-2 text-center">
            {card.printingDetails?.name || card.printingDetails?.display_name || label}
          </div>
        )}

        {/* Action buttons - show on hover, overlaid on card */}
        {(onEdit || onSwap || onMove || onRemove || onRemoveFromWants || onAddToBinder || onRemoveFromBinder) && (
          <div className="absolute bottom-2 left-0 right-0 flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Wants stack: + above - above heart */}
          {onEdit && (
            <div className="flex flex-col items-center gap-0.5">
              {/* Reserve space for + button to keep heart anchored */}
              {wantsInfo && wantsInfo.wanted > 0 && onEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 bg-gray-900/80 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  title="Want more"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              ) : (
                <div className="h-5 w-5" />
              )}
              {/* Reserve space for - button to keep heart anchored */}
              {onRemoveFromWants && wantsInfo && wantsInfo.wanted > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 bg-gray-900/80 hover:bg-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromWants();
                  }}
                  title="Want less"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              ) : (
                <div className="h-5 w-5" />
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${wantsInfo && wantsInfo.wanted > 0 ? 'bg-pink-700 hover:bg-pink-600' : 'bg-gray-900/80 hover:bg-pink-700'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title={wantsInfo && wantsInfo.wanted > 0
                  ? `Want ${wantsInfo.wanted} of ${wantsInfo.inDeck}`
                  : "Add to wants"}
              >
                <Heart className={`h-4 w-4 ${wantsInfo && wantsInfo.wanted > 0 ? 'fill-current' : ''}`} />
              </Button>
            </div>
          )}
          {/* Binder stack: + above - above book */}
          {onAddToBinder && (
            <div className="flex flex-col items-center gap-0.5">
              {/* Reserve space for + button to keep book anchored */}
              {binderInfo && binderInfo.owned > 0 && onAddToBinder ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 bg-gray-900/80 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToBinder();
                  }}
                  title="Add more to binder"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              ) : (
                <div className="h-5 w-5" />
              )}
              {/* Reserve space for - button to keep book anchored */}
              {onRemoveFromBinder && binderInfo && binderInfo.owned > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 bg-gray-900/80 hover:bg-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromBinder();
                  }}
                  title="Remove from binder"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              ) : (
                <div className="h-5 w-5" />
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${binderInfo && binderInfo.owned > 0 ? 'bg-blue-700 hover:bg-blue-600' : 'bg-gray-900/80 hover:bg-blue-700'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToBinder();
                }}
                title={binderInfo && binderInfo.owned > 0
                  ? `Have ${binderInfo.owned} in binder`
                  : "Add to binder"}
              >
                <BookOpen className={`h-4 w-4 ${binderInfo && binderInfo.owned > 0 ? 'fill-current' : ''}`} />
              </Button>
            </div>
          )}
          {/* Swap printing - with spacers to match height */}
          {onSwap && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-5 w-5" />
              <div className="h-5 w-5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-gray-900/80 hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap();
                }}
                title="Swap printing"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
          {/* Move to inventory - with spacers to match height */}
          {onMove && category !== 'hero' && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-5 w-5" />
              <div className="h-5 w-5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-gray-900/80 hover:bg-gray-700 text-xs font-semibold flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove();
                }}
                title="Move to inventory"
              >
                INV
              </Button>
            </div>
          )}
          {/* Delete - with spacers to match height */}
          {onRemove && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-5 w-5" />
              <div className="h-5 w-5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-gray-900/80 hover:bg-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                title="Remove from deck"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlaymatView({
  deck,
  onZoneClick,
  onShuffle,
  onSearch,
  onEdit,
  onSwap,
  onMove,
  onRemove,
  onAddCard,
  onAddToWants,
  onRemoveFromWants,
  onAddToBinder,
  onRemoveFromBinder,
  onToggleForTrade,
  editable = false,
  ownershipRefreshKey = 0,
  wantsMap = new Map(),
  deckCardCounts = new Map(),
  binderMap = new Map()
}: PlaymatViewProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [expandedZone, setExpandedZone] = useState<{
    title: string;
    cards: (DeckPrinting & { category: string })[];
  } | null>(null);
  const [ownershipStatus, setOwnershipStatus] = useState<Map<string, { owned: number; needed: number; alternative?: number; forTrade?: boolean; inventoryItemIds?: string[]; binderSlugs?: string[]; binderNames?: string[]; binderIds?: string[] }> | null>(null);

  // Fetch ownership data when deck changes
  React.useEffect(() => {
    const fetchOwnershipData = async () => {
      if (!deck._id) return;

      try {
        const result = await decksClient.getInventoryComparison(deck._id, { binderMode: 'all' });
        if (!result.success) return;
        setOwnershipStatus(buildOwnershipMap(result.data));
      } catch (error) {
        console.error('[PlaymatView] Failed to fetch ownership data:', error);
        // Don't show error to user, just silently fail
      }
    };

    fetchOwnershipData();
  }, [deck._id, ownershipRefreshKey]);

  // Update expanded zone when deck data changes (after swap, etc.)
  React.useEffect(() => {
    if (!expandedZone) return;

    // Map of zone title to category
    const getCategoryFromTitle = (title: string): string | null => {
      if (title.includes('Hero')) return 'hero';
      if (title.includes('Equipment')) return 'equipment';
      if (title.includes('Library') || title.includes('Main Deck')) return 'maindeck';
      if (title.includes('Inventory')) return 'inventory';
      if (title.includes('Tokens')) return 'tokens';
      if (title.includes('Maybeboard')) return 'maybeboard';
      return null;
    };

    const category = getCategoryFromTitle(expandedZone.title);
    if (!category) return;

    // Get the fresh cards for this category
    const categoryKey = category as keyof Pick<typeof deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'tokens' | 'maybeboard'>;
    const freshCards = deck[categoryKey] as DeckPrinting[] | undefined;

    if (freshCards) {
      // Update expanded zone with fresh card data
      setExpandedZone({
        title: expandedZone.title,
        cards: freshCards.map(c => ({ ...c, category }))
      });
    }
  }, [deck.hero, deck.equipment, deck.maindeck, deck.inventory, deck.tokens, deck.maybeboard]);

  // Organize equipment by type - parse from printingDetails.types
  // Use useMemo to ensure this recalculates when deck.equipment changes
  const equipment = useMemo(() => {
    console.log('[PlaymatView] ===== EQUIPMENT ASSIGNMENT =====');
    console.log('[PlaymatView] Total equipment items:', deck.equipment.length);

    const slots = {
      head: undefined as DeckPrinting | undefined,
      chest: undefined as DeckPrinting | undefined,
      arms: undefined as DeckPrinting | undefined,
      legs: undefined as DeckPrinting | undefined,
      weapon1: undefined as DeckPrinting | undefined,
      weapon2: undefined as DeckPrinting | undefined,
    };

    // Temporary arrays to hold weapons and off-hands for processing
    const weapons: DeckPrinting[] = [];
    const offHands: DeckPrinting[] = [];

    // First pass: assign armor slots and collect weapons/off-hands
    deck.equipment.forEach((item) => {
      const types = item.printingDetails?.types || [];
      const name = item.printingDetails?.display_name || item.printingDetails?.name;

      console.log('[PlaymatView] Processing:', name, '| types:', types);

      // Check for equipment slot types
      if (types.includes('head') && !slots.head) {
        slots.head = item;
        console.log('[PlaymatView]   -> Assigned to HEAD slot');
      } else if (types.includes('chest') && !slots.chest) {
        slots.chest = item;
        console.log('[PlaymatView]   -> Assigned to CHEST slot');
      } else if (types.includes('arms') && !slots.arms) {
        slots.arms = item;
        console.log('[PlaymatView]   -> Assigned to ARMS slot');
      } else if (types.includes('legs') && !slots.legs) {
        slots.legs = item;
        console.log('[PlaymatView]   -> Assigned to LEGS slot');
      } else if (types.includes('weapon')) {
        weapons.push(item);
        console.log('[PlaymatView]   -> Added to WEAPONS array');
      } else if (types.includes('off-hand')) {
        offHands.push(item);
        console.log('[PlaymatView]   -> Added to OFF-HANDS array');
      } else {
        console.log('[PlaymatView]   -> NOT ASSIGNED (no matching type)');
      }
    });

    console.log('[PlaymatView] Weapons collected:', weapons.length);
    console.log('[PlaymatView] Off-hands collected:', offHands.length);

    // Second pass: assign weapons based on 1H/2H rules
    // Priority: 2H weapons first, then 1H weapons, then off-hands
    const twoHandedWeapons = weapons.filter(w => {
      const types = w.printingDetails?.types || [];
      const subtypes = w.printingDetails?.subtypes || [];
      // Check BOTH types and subtypes for 2H designation
      return types.includes('2h') || subtypes.includes('2h');
    });

    const oneHandedWeapons = weapons.filter(w => {
      const types = w.printingDetails?.types || [];
      const subtypes = w.printingDetails?.subtypes || [];
      // Check BOTH types and subtypes for 1H designation
      const is2H = types.includes('2h') || subtypes.includes('2h');
      return types.includes('1h') || subtypes.includes('1h') || !is2H; // Default to 1H if not specified
    });

    console.log('[PlaymatView] 2H weapons:', twoHandedWeapons.length);
    console.log('[PlaymatView] 1H weapons:', oneHandedWeapons.length);

    if (twoHandedWeapons.length > 0) {
      // 2H weapon takes weapon1 slot and blocks weapon2
      slots.weapon1 = twoHandedWeapons[0];
      slots.weapon2 = undefined;
      console.log('[PlaymatView] Assigned 2H weapon to weapon1, weapon2 blocked');
      // Any other weapons or off-hands should go to inventory (handled by not assigning them)
    } else {
      // No 2H weapon, so we can use both slots with 1H weapons and/or off-hands
      // Assign first 1H weapon to weapon1, or off-hand if no weapons
      if (oneHandedWeapons.length > 0) {
        slots.weapon1 = oneHandedWeapons[0];
        console.log('[PlaymatView] Assigned 1H weapon to weapon1:', oneHandedWeapons[0].printingDetails?.display_name);
      } else if (offHands.length > 0 && oneHandedWeapons.length === 0) {
        // If no weapons at all, allow off-hand in weapon1 slot
        slots.weapon1 = offHands[0];
        console.log('[PlaymatView] Assigned off-hand to weapon1:', offHands[0].printingDetails?.display_name);
      }

      // Assign second slot: can be another 1H weapon OR an off-hand (but not two off-hands)
      if (oneHandedWeapons.length > 1) {
        // Prefer second 1H weapon if available
        slots.weapon2 = oneHandedWeapons[1];
        console.log('[PlaymatView] Assigned 1H weapon to weapon2:', oneHandedWeapons[1].printingDetails?.display_name);
      } else if (offHands.length > 0 && !slots.weapon1) {
        // Use first off-hand if no weapon1
        slots.weapon2 = offHands[0];
        console.log('[PlaymatView] Assigned off-hand to weapon2 (no weapon1):', offHands[0].printingDetails?.display_name);
      } else if (offHands.length > 0 && slots.weapon1 && !slots.weapon1.printingDetails?.types?.includes('off-hand')) {
        // Use off-hand in weapon2 if weapon1 is NOT an off-hand
        slots.weapon2 = offHands[0];
        console.log('[PlaymatView] Assigned off-hand to weapon2 (weapon1 exists):', offHands[0].printingDetails?.display_name);
      } else if (offHands.length > 1 && slots.weapon1?.printingDetails?.types?.includes('off-hand')) {
        // If weapon1 is an off-hand, use second off-hand for weapon2
        slots.weapon2 = offHands[1];
        console.log('[PlaymatView] Assigned 2nd off-hand to weapon2:', offHands[1].printingDetails?.display_name);
      }
    }

    console.log('[PlaymatView] Final weapon1:', slots.weapon1?.printingDetails?.display_name || 'empty');
    console.log('[PlaymatView] Final weapon2:', slots.weapon2?.printingDetails?.display_name || 'empty');
    console.log('[PlaymatView] ===== END EQUIPMENT ASSIGNMENT =====');

    return slots;
  }, [deck.equipment]);

  const hero = deck.hero[0];

  // Separate inventory into equipment/weapons vs generic cards
  // Also include any unassigned weapons/off-hands from equipment category
  const { inventoryEquipment, inventoryGeneric } = useMemo(() => {
    const equipmentItems: DeckPrinting[] = [];
    const genericItems: DeckPrinting[] = [];

    // Add items from inventory category
    deck.inventory.forEach((item) => {
      const types = item.printingDetails?.types || [];
      const isEquipmentOrWeapon = types.includes('equipment') || types.includes('weapon') || types.includes('off-hand');

      if (isEquipmentOrWeapon) {
        equipmentItems.push(item);
      } else {
        genericItems.push(item);
      }
    });

    // Add unassigned equipment category items (weapons/off-hands that didn't fit in slots)
    deck.equipment.forEach((item) => {
      const types = item.printingDetails?.types || [];
      const subtypes = item.printingDetails?.subtypes || [];

      // Check if this item is assigned to any slot
      const isAssigned =
        equipment.head === item ||
        equipment.chest === item ||
        equipment.arms === item ||
        equipment.legs === item ||
        equipment.weapon1 === item ||
        equipment.weapon2 === item;

      // If not assigned and is a weapon or off-hand, add to equipment inventory
      if (!isAssigned && (types.includes('weapon') || types.includes('off-hand'))) {
        equipmentItems.push(item);
      }
    });

    return {
      inventoryEquipment: equipmentItems,
      inventoryGeneric: genericItems
    };
  }, [deck.inventory, deck.equipment, equipment]);

  // Helper to open expanded view for a single card
  const handleSingleCardClick = (card: DeckPrinting | undefined, category: string, title: string) => {
    if (!card) return;

    setExpandedZone({
      title,
      cards: [{ ...card, category }]
    });
  };

  // Helper to create card props with actions
  const getCardProps = (card: DeckPrinting | undefined, category: string) => {
    if (!editable) return {};

    // If no card, only provide onAdd handler
    if (!card) {
      return {
        onAdd: onAddCard ? () => onAddCard(category) : undefined,
      };
    }

    // If card exists, provide wants/swap/move/remove handlers
    const wantedQty = wantsMap.get(card.printingId) || 0;
    const inDeckQty = deckCardCounts.get(card.printingId) || 0;
    const binderInfo = binderMap.get(card.printingId);
    const ownedQty = binderInfo?.quantity || 0;

    return {
      onEdit: onAddToWants ? () => onAddToWants({ ...card, category }) : undefined,
      onRemoveFromWants: onRemoveFromWants ? () => onRemoveFromWants({ ...card, category }) : undefined,
      onAddToBinder: onAddToBinder ? () => onAddToBinder({ ...card, category }) : undefined,
      onRemoveFromBinder: onRemoveFromBinder ? () => onRemoveFromBinder({ ...card, category }) : undefined,
      onSwap: onSwap ? () => onSwap({ ...card, category }) : undefined,
      onMove: onMove ? () => onMove({ ...card, category }) : undefined,
      onRemove: onRemove ? () => onRemove({ ...card, category }) : undefined,
      wantsInfo: { wanted: wantedQty, inDeck: inDeckQty },
      binderInfo: { owned: ownedQty, inDeck: inDeckQty },
    };
  };

  return (
    <div className="relative w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl overflow-hidden px-4 pt-2 pb-2">
      {/* Background texture overlay */}
      <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTMwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')]" />

      {/* 
        ============================================================
        == NEW SCALING WRAPPER ADDED HERE
        ============================================================
        - This div wraps your grid and applies responsive scaling.
        - origin-top makes it scale from the top edge.
        - scale-[.85] is the default size for small screens.
        - sm:scale-90 and lg:scale-100 increase the size on larger screens.
        - You can adjust these values to perfectly fit your target devices.
      */}
      <div className="transition-transform duration-300 ease-in-out origin-top scale-[.85] sm:scale-90 lg:scale-100">

        {/* Your existing grid layout is now inside the scaling wrapper */}
        <div className="relative grid grid-cols-[140px_140px_1fr_140px_140px_140px_1fr_140px_140px] grid-rows-[220px_220px_220px] gap-3 h-full">
          {/* Row 1: Head, Space, Graveyard */}
          <div className="col-start-1 row-start-1">
            <CardZone
              title="Head"
              count={equipment.head ? 1 : 0}
              onClick={() => equipment.head && handleSingleCardClick(equipment.head, 'equipment', 'Head Equipment')}
            >
              <SingleCard card={equipment.head} label="Head" category="equipment" {...getCardProps(equipment.head, 'equipment')} />
            </CardZone>
          </div>

          <div className="col-start-9 row-start-1">
            <CardZone title="Graveyard" count={0} isEmpty>
              <div className="h-full flex items-center justify-center text-gray-600 text-xs">Empty</div>
            </CardZone>
          </div>

          {/* Row 2: Chest, Arms, Weapon, Hero, Weapon, Pitch, Library */}
          <div className="col-start-1 row-start-2">
            <CardZone
              title="Chest"
              count={equipment.chest ? 1 : 0}
              onClick={() => equipment.chest && handleSingleCardClick(equipment.chest, 'equipment', 'Chest Equipment')}
            >
              <SingleCard card={equipment.chest} label="Chest" category="equipment" {...getCardProps(equipment.chest, 'equipment')} />
            </CardZone>
          </div>
          <div className="col-start-2 row-start-2">
            <CardZone
              title="Arms"
              count={equipment.arms ? 1 : 0}
              onClick={() => equipment.arms && handleSingleCardClick(equipment.arms, 'equipment', 'Arms Equipment')}
            >
              <SingleCard card={equipment.arms} label="Arms" category="equipment" {...getCardProps(equipment.arms, 'equipment')} />
            </CardZone>
          </div>

          <div className="col-start-4 row-start-2">
            <CardZone
              title="Weapon"
              count={equipment.weapon1 ? 1 : 0}
              onClick={() => equipment.weapon1 && handleSingleCardClick(equipment.weapon1, 'equipment', 'Weapon')}
            >
              <SingleCard card={equipment.weapon1} label="Weapon" category="equipment" {...getCardProps(equipment.weapon1, 'equipment')} />
            </CardZone>
          </div>
          <div className="col-start-5 row-start-2">
            <CardZone
              title="Hero"
              count={hero ? 1 : 0}
              onClick={() => hero && handleSingleCardClick(hero, 'hero', 'Hero')}
              highlight={true}
            >
              <SingleCard card={hero} label="Hero" category="hero" {...getCardProps(hero, 'hero')} />
            </CardZone>
          </div>
          <div className="col-start-6 row-start-2">
            {/* Check if weapon1 is 2H - if so, block weapon2 slot */}
            {equipment.weapon1 && (
              equipment.weapon1.printingDetails?.types?.includes('2h') ||
              equipment.weapon1.printingDetails?.subtypes?.includes('2h')
            ) ? (
              <CardZone
                title="Weapon (Blocked)"
                count={0}
                isEmpty
              >
                <div className="h-full flex items-center justify-center text-gray-600 text-xs p-2 text-center">
                  2H Weapon Equipped
                </div>
              </CardZone>
            ) : (
              <CardZone
                title="Weapon / Off-hand"
                count={equipment.weapon2 ? 1 : 0}
                onClick={() => equipment.weapon2 && handleSingleCardClick(equipment.weapon2, 'equipment', 'Weapon / Off-hand')}
              >
                <SingleCard card={equipment.weapon2} label="Weapon / Off-hand" category="equipment" {...getCardProps(equipment.weapon2, 'equipment')} />
              </CardZone>
            )}
          </div>

          <div className="col-start-8 row-start-2">
            <CardZone
              title="Pitch"
              count={0}
              isEmpty={true}
            >
              <div className="h-full flex items-center justify-center text-gray-600 text-xs">Empty</div>
            </CardZone>
          </div>
          <div className="col-start-9 row-start-2">
            <CardZone
              title="Library"
              count={deck.maindeck.length}
              onClick={() => setExpandedZone({
                title: 'Library / Main Deck',
                cards: deck.maindeck.map(c => ({ ...c, category: 'maindeck' }))
              })}
              highlight={hoveredZone === 'library'}
              actions={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 bg-gray-900/80 hover:bg-gray-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      setExpandedZone({
                        title: 'Library / Main Deck',
                        cards: deck.maindeck.map(c => ({ ...c, category: 'maindeck' }))
                      });
                    }}>
                      <Eye className="h-4 w-4 mr-2" />
                      View All Cards
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSearch?.(); }}>
                      <Search className="h-4 w-4 mr-2" />
                      Search Deck
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShuffle?.(); }}>
                      <Shuffle className="h-4 w-4 mr-2" />
                      Shuffle
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            >
              <CardStackPreview cards={deck.maindeck} maxVisible={5} />
            </CardZone>
          </div>

          {/* Row 3: Legs, Equipment Inventory, Generic Inventory, Banished */}
          <div className="col-start-1 row-start-3">
            <CardZone
              title="Legs"
              count={equipment.legs ? 1 : 0}
              onClick={() => equipment.legs && handleSingleCardClick(equipment.legs, 'equipment', 'Legs Equipment')}
            >
              <SingleCard card={equipment.legs} label="Legs" category="equipment" {...getCardProps(equipment.legs, 'equipment')} />
            </CardZone>
          </div>

          <div className="col-start-2 row-start-3">
            <CardZone
              title="Equipment Inv."
              count={inventoryEquipment.length}
              onClick={() => setExpandedZone({
                title: 'Equipment Inventory',
                cards: inventoryEquipment.map(c => ({ ...c, category: 'inventory' }))
              })}
            >
              <CardStackPreview cards={inventoryEquipment} maxVisible={3} />
            </CardZone>
          </div>

          <div className="col-start-8 row-start-3">
            <CardZone
              title="Inventory"
              count={inventoryGeneric.length}
              onClick={() => setExpandedZone({
                title: 'Inventory',
                cards: inventoryGeneric.map(c => ({ ...c, category: 'inventory' }))
              })}
            >
              <CardStackPreview cards={inventoryGeneric} maxVisible={3} />
            </CardZone>
          </div>

          <div className="col-start-9 row-start-3">
            <CardZone title="Banished" count={0} isEmpty>
              <div className="h-full flex items-center justify-center text-gray-600 text-xs">Empty</div>
            </CardZone>
          </div>

          {/* Row 4: Tokens/Maybeboard spanning full width if present */}
          {(deck.tokens && deck.tokens.length > 0) || (deck.maybeboard && deck.maybeboard.length > 0) ? (
            <div className="col-span-12 flex gap-4 justify-center">
              {deck.tokens && deck.tokens.length > 0 && (
                <div className="w-64 h-32">
                  <CardZone
                    title="Tokens"
                    count={deck.tokens.length}
                    onClick={() => setExpandedZone({
                      title: 'Tokens',
                      cards: deck.tokens.map(c => ({ ...c, category: 'tokens' }))
                    })}
                  >
                    <CardStackPreview cards={deck.tokens} maxVisible={3} />
                  </CardZone>
                </div>
              )}
              {deck.maybeboard && deck.maybeboard.length > 0 && (
                <div className="w-64 h-32">
                  <CardZone
                    title="Maybeboard"
                    count={deck.maybeboard.length}
                    onClick={() => setExpandedZone({
                      title: 'Maybeboard',
                      cards: deck.maybeboard.map(c => ({ ...c, category: 'maybeboard' }))
                    })}
                  >
                    <CardStackPreview cards={deck.maybeboard} maxVisible={3} />
                  </CardZone>
                </div>
              )}
            </div>
          ) : null}
        </div>
        
      </div> 
      {/* End of the new scaling wrapper */}


      {/* Expanded Zone Modal */}
      {expandedZone && (
        <CardZoneExpanded
          open={!!expandedZone}
          onOpenChange={(open) => !open && setExpandedZone(null)}
          title={expandedZone.title}
          cards={expandedZone.cards}
          onEdit={onEdit}
          onSwap={(card) => {
            // Call the parent onSwap handler (opens swap dialog)
            if (onSwap) onSwap(card);
            // Keep the expanded zone open - it will update when deck data refreshes
          }}
          onMove={(card) => {
            // Call the parent onMove handler
            if (onMove) onMove(card);
            // Remove the card from the expanded view immediately
            setExpandedZone(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                cards: prev.cards.filter(c =>
                  !(c.printingId === card.printingId && c.category === card.category)
                )
              };
            });
          }}
          onRemove={onRemove}
          onAddToWants={onAddToWants}
          onAddToBinder={onAddToBinder}
          onRemoveFromBinder={onRemoveFromBinder}
          onRemoveFromWants={onRemoveFromWants}
          onToggleForTrade={onToggleForTrade}
          editable={editable}
          deckId={deck._id}
          ownershipStatus={ownershipStatus || undefined}
          wantsMap={wantsMap}
          deckCardCounts={deckCardCounts}
          binderMap={binderMap}
        />
      )}
    </div>
  );
}
