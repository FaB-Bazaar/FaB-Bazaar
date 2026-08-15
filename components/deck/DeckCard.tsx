// components/deck/DeckCard.tsx - Updated for new deck structure
"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Trash2,
  Copy,
  Eye,
  Lock,
  Globe,
  Calendar,
  BarChart3,
  Settings,
  Swords,
  Info,
  Star,
  Shield,
  Pin,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TalisharToggle from "@/components/deck/TalisharToggle";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  printingDetails?: {
    name: string;
    display_name: string;
    card_unique_id: string;
    tcg_market?: number;
    [key: string]: any;
  };
}

interface Deck {
  _id: string;
  publicId?: string;
  userId: string;
  name: string;
  description?: string;
  format: string;
  visibility?: 'private' | 'unlisted' | 'public';
  isPublic: boolean;
  isCoOwned?: boolean;
  ownerUsername?: string;
  availableOnTalishar?: boolean;
  featured?: boolean;
  isSystemDeck?: boolean;
  pinnedInNav?: boolean;
  metafyGuideId?: string | null;
  /** User-defined folder label (null/undefined = unfiled) */
  folder?: string | null;
  // New structure - arrays by category
  hero: DeckPrinting[];
  equipment: DeckPrinting[];
  maindeck: DeckPrinting[];
  inventory: DeckPrinting[];
  maybeboard?: DeckPrinting[];
  tokens?: DeckPrinting[];
  // Computed stats
  totalCards: number;
  heroCount: number;
  equipmentCount: number;
  maindeckCount: number;
  inventoryCount: number;
  benchedCount?: number;
  maybeboardCount?: number;
  tokensCount?: number;
  estimatedValue: number;
  createdAt: string;
  updatedAt: string;
}

interface DeckCardProps {
  deck: Deck;
  matchupCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onView: () => void;
  onToggleTalishar?: (deckId: string, value: boolean) => void;
  onTogglePin?: (deckId: string, value: boolean) => void;
  onChangeVisibility?: (deckId: string, value: 'private' | 'unlisted' | 'public') => void;
  onSettings?: () => void;
  /** When provided, the folder chip becomes a button that filters the list by that folder. */
  onFolderClick?: (folder: string) => void;
}

export default function DeckCard({
  deck,
  matchupCount = 0,
  onEdit,
  onDelete,
  onDuplicate,
  onView,
  onToggleTalishar,
  onTogglePin,
  onChangeVisibility,
  onSettings,
  onFolderClick,
}: DeckCardProps) {
  const [heroPreview, setHeroPreview] = useState<{ url: string; x: number; y: number } | null>(null);
  
  // Get format color
  const getFormatColor = (format: string) => {
    const colors = {
      'Classic Constructed': 'bg-blue-500',
      'Blitz': 'bg-red-500',
      'Limited': 'bg-green-500',
      'Commoner': 'bg-yellow-500',
      'Living Legend': 'bg-purple-500'
    };
    return colors[format as keyof typeof colors] || 'bg-gray-500';
  };

  // Calculate deck composition — prefer pre-computed counts, fall back to array lengths
  const deckStats = {
    heroes: deck.heroCount ?? (deck.hero || []).length,
    equipment: deck.equipmentCount ?? (deck.equipment || []).length,
    maindeck: deck.maindeckCount ?? (deck.maindeck || []).length,
    inventory: deck.inventoryCount ?? (deck.inventory || []).length,
    benched: deck.benchedCount ?? 0,
    maybeboard: deck.maybeboardCount ?? (deck.maybeboard || []).length,
    tokens: deck.tokensCount ?? (deck.tokens || []).length
  };

  // Use pre-calculated values from the new structure
  const totalCards = deck.totalCards || 0;
  const estimatedValue = deck.estimatedValue || 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
    <>
    <div data-testid="deck-card" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-300 dark:border-gray-700 overflow-visible">
        <div className="flex items-start gap-3">
          {/* Hero image with hover expand */}
          {(() => {
            // Support both summary DTOs (heroImageUrl) and full DTOs (hero[0].printingDetails)
            // Only stored image_urls render — printing_id-keyed CDN URLs 404
            // (old images deleted 2026-07), so no constructed fallback.
            const heroImgUrl = deck.heroImageUrl
              || deck.hero?.[0]?.printingDetails?.image_url
              || null;
            const heroDisplayName = deck.heroDisplayName
              || deck.hero?.[0]?.printingDetails?.display_name
              || deck.hero?.[0]?.printingDetails?.name
              || deck.heroName;
            if (!heroImgUrl) return null;
            return (
              <div className="flex-shrink-0">
                <img
                  src={heroImgUrl}
                  alt={heroDisplayName || "Hero"}
                  className="w-12 h-16 object-cover rounded cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setHeroPreview({ url: heroImgUrl, x: rect.right + 8, y: rect.top });
                  }}
                  onMouseLeave={() => setHeroPreview(null)}
                />
              </div>
            );
          })()}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <Link
                href={`/decks/${deck.publicId ?? deck._id}`}
                className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate flex-1 mr-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {deck.name}
              </Link>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {deck.isSystemDeck && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-medium" title="System deck — hidden from personal views">
                    <Shield className="h-2.5 w-2.5" />
                    System
                  </span>
                )}
                {deck.featured && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 font-medium" title="Featured in Decks to Beat">
                    <Star className="h-2.5 w-2.5" />
                    Featured
                  </span>
                )}
                {deck.isCoOwned && (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 font-medium" title="You are a co-owner of this deck">
                    Shared
                  </span>
                )}
                {deck.description && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">
                      {deck.description}
                    </TooltipContent>
                  </Tooltip>
                )}
                {deck.visibility === 'public' ? (
                  <Globe className="h-4 w-4 text-green-500" title="Public — listed in Community Decks" />
                ) : deck.visibility === 'unlisted' ? (
                  <Eye className="h-4 w-4 text-blue-400" title="Unlisted — accessible via link" />
                ) : (
                  <Lock className="h-4 w-4 text-gray-400" title="Private — only you can see this" />
                )}
              </div>
            </div>

            {/* Co-owner attribution */}
            {deck.isCoOwned && deck.ownerUsername && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 -mt-1">
                by {deck.ownerUsername}
              </p>
            )}

            {/* Format + folder */}
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <Badge className={cn("text-white text-xs", getFormatColor(deck.format))}>
                {deck.format}
              </Badge>
              {deck.folder && (
                onFolderClick ? (
                  <button
                    type="button"
                    onClick={() => onFolderClick(deck.folder!)}
                    aria-label={`Folder: ${deck.folder}`}
                    title={`Show only decks in "${deck.folder}"`}
                    className="inline-flex items-center gap-1 max-w-full text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
                  >
                    <Folder className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{deck.folder}</span>
                  </button>
                ) : (
                  <span
                    aria-label={`Folder: ${deck.folder}`}
                    className="inline-flex items-center gap-1 max-w-full text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  >
                    <Folder className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{deck.folder}</span>
                  </span>
                )
              )}
            </div>

            {/* Hero name */}
            {(deck.heroDisplayName || deck.hero?.[0]?.printingDetails?.display_name || deck.hero?.[0]?.printingDetails?.name || deck.heroName) && (
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate mb-1">
                {deck.heroDisplayName || deck.hero?.[0]?.printingDetails?.display_name || deck.hero?.[0]?.printingDetails?.name || deck.heroName}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{totalCards} cards</span>
              {estimatedValue > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ~${estimatedValue.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Deck Composition */}
      <div className="p-4 flex-1">
        <div className="space-y-2">
          {deckStats.equipment > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Equipment:</span>
              <span className="font-medium">{deckStats.equipment}</span>
            </div>
          )}
          {deckStats.maindeck > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Main Deck:</span>
              <span className="font-medium">{deckStats.maindeck}</span>
            </div>
          )}
          {deckStats.inventory > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Inventory:</span>
              <span className="font-medium">{deckStats.inventory}</span>
            </div>
          )}
          {deckStats.benched > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Bench:</span>
              <span className="font-medium">{deckStats.benched}</span>
            </div>
          )}
          {deckStats.maybeboard > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Maybeboard:</span>
              <span className="font-medium">{deckStats.maybeboard}</span>
            </div>
          )}
          {deckStats.tokens > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tokens:</span>
              <span className="font-medium">{deckStats.tokens}</span>
            </div>
          )}

          {/* Show empty state if no cards */}
          {totalCards === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              Empty deck
            </div>
          )}

          {matchupCount > 0 && (
            <div className="flex justify-between text-sm pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
              <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Swords className="h-3 w-3" aria-hidden="true" />
                Matchups:
              </span>
              <span className="font-medium">{matchupCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compact footer: Visibility · Talishar · Date */}
      <div className="px-4 pb-4 pt-3 border-t border-gray-300 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {onChangeVisibility && (
            <div className="flex items-center gap-1">
              <select
                value={deck.visibility || 'unlisted'}
                onChange={(e) => onChangeVisibility(deck.publicId ?? deck._id, e.target.value as 'private' | 'unlisted' | 'public')}
                className="text-sm h-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5"
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs leading-relaxed">
                  <p><strong>Public</strong> — listed in Community Decks</p>
                  <p><strong>Unlisted</strong> — accessible via link only</p>
                  <p><strong>Private</strong> — only you can see this</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {onChangeVisibility && onToggleTalishar && (
            <span className="text-gray-300 dark:text-gray-600 select-none">·</span>
          )}

          {onToggleTalishar && (
            <div className="flex items-center gap-1">
              <TalisharToggle
                checked={deck.availableOnTalishar ?? false}
                onChange={(val) => onToggleTalishar(deck.publicId ?? deck._id, val)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs leading-relaxed">
                  When enabled, this deck can be imported directly on Talishar for online play.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {onTogglePin && (
            <>
              <span className="text-gray-300 dark:text-gray-600 select-none">·</span>
              <button
                type="button"
                onClick={() => onTogglePin(deck.publicId ?? deck._id, !deck.pinnedInNav)}
                className={`inline-flex items-center gap-1 text-xs rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors ${
                  deck.pinnedInNav
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={deck.pinnedInNav ? 'Unpin from navbar' : 'Pin to navbar'}
                aria-pressed={deck.pinnedInNav ?? false}
                aria-label={deck.pinnedInNav ? `Unpin ${deck.name} from navbar` : `Pin ${deck.name} to navbar`}
              >
                <Pin className={`h-3 w-3 ${deck.pinnedInNav ? 'fill-current' : ''}`} />
                <span>Pin</span>
              </button>
            </>
          )}

          <div className="flex items-center gap-1 ml-auto text-xs text-gray-600 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(deck.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-300 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            Open Deck
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            className="h-8 w-8 p-0"
            title="Analyze deck"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          {onSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="h-8 w-8 p-0"
              title="Deck settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            className="h-8 w-8 p-0"
            title="Duplicate deck"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
            title="Delete deck"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    {/* Hero preview portal — renders outside all overflow containers */}
    {heroPreview && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{ left: heroPreview.x, top: heroPreview.y }}
      >
        <img
          src={heroPreview.url}
          alt="Hero preview"
          className="w-56 h-auto rounded-lg shadow-2xl border border-gray-300 dark:border-gray-500"
        />
      </div>,
      document.body
    )}
    </>
    </TooltipProvider>
  );
}
// // components/deck/DeckCard.tsx - Updated for new printings data model
// "use client";

// import React from "react";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { 
//   Edit3, 
//   Trash2, 
//   Copy, 
//   Eye, 
//   Share2,
//   Lock,
//   Globe,
//   Calendar,
//   BarChart3
// } from "lucide-react";
// import { cn } from "@/lib/utils";

// interface DeckPrinting {
//   _id?: string;
//   printingId: string;
//   category: 'hero' | 'equipment' | 'main' | 'sideboard';
//   condition?: string;
//   notes?: string;
//   addedAt: string;
//   printingDetails?: {
//     name: string;
//     display_name: string;
//     card_unique_id: string;
//     tcg_market?: number;
//     [key: string]: any;
//   };
// }

// interface Deck {
//   _id: string;
//   userId: string;
//   name: string;
//   description?: string;
//   format: string;
//   hero?: string;
//   isPublic: boolean;
//   printings: DeckPrinting[]; // Updated to use printings array
//   createdAt: string;
//   updatedAt: string;
//   totalCards: number;
//   estimatedValue: number;
//   // Backwards compatibility - some API responses might still include cards
//   cards?: DeckPrinting[];
// }

// interface DeckCardProps {
//   deck: Deck;
//   onEdit: () => void;
//   onDelete: () => void;
//   onDuplicate: () => void;
//   onView: () => void;
// }

// export default function DeckCard({
//   deck,
//   onEdit,
//   onDelete,
//   onDuplicate,
//   onView
// }: DeckCardProps) {
  
//   // Get format color
//   const getFormatColor = (format: string) => {
//     const colors = {
//       'Classic Constructed': 'bg-blue-500',
//       'Blitz': 'bg-red-500',
//       'Limited': 'bg-green-500',
//       'Commoner': 'bg-yellow-500',
//       'Living Legend': 'bg-purple-500'
//     };
//     return colors[format as keyof typeof colors] || 'bg-gray-500';
//   };

//   // Use printings array (with backwards compatibility for cards)
//   const printings = deck.printings || deck.cards || [];

//   // Calculate deck composition from printings
//   const deckStats = {
//     heroes: printings.filter(p => p.category === 'hero').length,
//     equipment: printings.filter(p => p.category === 'equipment').length,
//     main: printings.filter(p => p.category === 'main').length,
//     sideboard: printings.filter(p => p.category === 'sideboard').length
//   };

//   // Calculate estimated value from printings if not pre-calculated
//   const calculatedValue = deck.estimatedValue || printings.reduce((total, printing) => {
//     return total + (printing.printingDetails?.tcg_market || 0);
//   }, 0);

//   // Use pre-calculated totalCards or calculate from printings
//   const totalCards = deck.totalCards || printings.length;

//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString('en-US', {
//       month: 'short',
//       day: 'numeric',
//       year: 'numeric'
//     });
//   };

//   return (
//     <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col">
//       {/* Header */}
//       <div className="p-4 border-b border-gray-300 dark:border-gray-700">
//         <div className="flex items-start justify-between mb-2">
//           <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate flex-1 mr-2">
//             {deck.name}
//           </h3>
//           <div className="flex items-center gap-1">
//             {deck.isPublic ? (
//               <Globe className="h-4 w-4 text-green-500" title="Public deck" />
//             ) : (
//               <Lock className="h-4 w-4 text-gray-400" title="Private deck" />
//             )}
//           </div>
//         </div>

//         {/* Format and Hero */}
//         <div className="flex items-center gap-2 mb-2">
//           <Badge className={cn("text-white text-xs", getFormatColor(deck.format))}>
//             {deck.format}
//           </Badge>
//           {deck.hero && (
//             <Badge variant="outline" className="text-xs">
//               {deck.hero}
//             </Badge>
//           )}
//         </div>

//         {/* Description */}
//         {deck.description && (
//           <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
//             {deck.description}
//           </p>
//         )}

//         {/* Stats */}
//         <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
//           <span>{totalCards} cards</span>
//           {calculatedValue > 0 && (
//             <span className="text-green-600 dark:text-green-400 font-medium">
//               ~${calculatedValue.toFixed(2)}
//             </span>
//           )}
//         </div>
//       </div>

//       {/* Deck Composition */}
//       <div className="p-4 flex-1">
//         <div className="space-y-2">
//           {deckStats.heroes > 0 && (
//             <div className="flex justify-between text-sm">
//               <span className="text-gray-600 dark:text-gray-400">Heroes:</span>
//               <span className="font-medium">{deckStats.heroes}</span>
//             </div>
//           )}
//           {deckStats.equipment > 0 && (
//             <div className="flex justify-between text-sm">
//               <span className="text-gray-600 dark:text-gray-400">Equipment:</span>
//               <span className="font-medium">{deckStats.equipment}</span>
//             </div>
//           )}
//           {deckStats.main > 0 && (
//             <div className="flex justify-between text-sm">
//               <span className="text-gray-600 dark:text-gray-400">Main Deck:</span>
//               <span className="font-medium">{deckStats.main}</span>
//             </div>
//           )}
//           {deckStats.sideboard > 0 && (
//             <div className="flex justify-between text-sm">
//               <span className="text-gray-600 dark:text-gray-400">Sideboard:</span>
//               <span className="font-medium">{deckStats.sideboard}</span>
//             </div>
//           )}
          
//           {/* Show empty state if no printings */}
//           {printings.length === 0 && (
//             <div className="text-sm text-gray-500 dark:text-gray-400 italic">
//               Empty deck
//             </div>
//           )}
//         </div>

//         {/* Last Updated */}
//         <div className="flex items-center gap-1 mt-4 text-xs text-gray-500 dark:text-gray-400">
//           <Calendar className="h-3 w-3" />
//           <span>Updated {formatDate(deck.updatedAt)}</span>
//         </div>
//       </div>

//       {/* Actions */}
//       <div className="p-4 border-t border-gray-300 dark:border-gray-700">
//         <div className="flex items-center justify-between">
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={onView}
//             className="flex-1 mr-2"
//           >
//             <Eye className="h-4 w-4 mr-1" />
//             View
//           </Button>
          
//           <div className="flex gap-1">
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={onEdit}
//               className="h-8 w-8 p-0"
//               title="Edit deck settings"
//             >
//               <Edit3 className="h-4 w-4" />
//             </Button>
            
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={onDuplicate}
//               className="h-8 w-8 p-0"
//               title="Duplicate deck"
//             >
//               <Copy className="h-4 w-4" />
//             </Button>
            
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={onDelete}
//               className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
//               title="Delete deck"
//             >
//               <Trash2 className="h-4 w-4" />
//             </Button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }