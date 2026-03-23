// components/deck/DeckCard.tsx - Updated for new deck structure
"use client";

import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Edit3,
  Trash2,
  Copy,
  Eye,
  Share2,
  Lock,
  Globe,
  Calendar,
  BarChart3,
  Star,
  Settings,
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
  availableOnTalishar?: boolean;
  featured?: boolean;
  metafyGuideId?: string | null;
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
  maybeboardCount?: number;
  tokensCount?: number;
  estimatedValue: number;
  createdAt: string;
  updatedAt: string;
}

interface DeckCardProps {
  deck: Deck;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onView: () => void;
  hasMetafyAccount?: boolean;
  onToggleTalishar?: (deckId: string, value: boolean) => void;
  onToggleFeatured?: (deckId: string, value: boolean) => void;
  isCurator?: boolean;
  onChangeVisibility?: (deckId: string, value: 'private' | 'unlisted' | 'public') => void;
  onUpdateMetafyGuideId?: (deckId: string, value: string | null) => void;
  onSettings?: () => void;
}

export default function DeckCard({
  deck,
  onEdit,
  onDelete,
  onDuplicate,
  onView,
  hasMetafyAccount,
  onToggleTalishar,
  onToggleFeatured,
  isCurator,
  onChangeVisibility,
  onUpdateMetafyGuideId,
  onSettings,
}: DeckCardProps) {
  const [metafyGuideIdDraft, setMetafyGuideIdDraft] = useState(deck.metafyGuideId ?? '');
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

  // Calculate deck composition from new structure
  const deckStats = {
    heroes: deck.heroCount || (deck.hero || []).length,
    equipment: deck.equipmentCount || (deck.equipment || []).length,
    maindeck: deck.maindeckCount || (deck.maindeck || []).length,
    inventory: deck.inventoryCount || (deck.inventory || []).length,
    maybeboard: deck.maybeboardCount || (deck.maybeboard || []).length,
    tokens: deck.tokensCount || (deck.tokens || []).length
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
    <>
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 overflow-visible">
        <div className="flex items-start gap-3">
          {/* Hero image with hover expand */}
          {deck.hero && deck.hero.length > 0 && (() => {
            const hero = deck.hero[0];
            const imgUrl = hero.printingDetails?.image_url ||
              `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${hero.printingId}/public`;
            return (
              <div className="flex-shrink-0">
                <img
                  src={imgUrl}
                  alt={hero.printingDetails?.display_name || "Hero"}
                  className="w-12 h-16 object-cover rounded cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setHeroPreview({ url: imgUrl, x: rect.right + 8, y: rect.top });
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
              <div className="flex items-center gap-1 flex-shrink-0">
                {deck.visibility === 'public' ? (
                  <Globe className="h-4 w-4 text-green-500" title="Public — listed in Community Decks" />
                ) : deck.visibility === 'unlisted' ? (
                  <Eye className="h-4 w-4 text-blue-400" title="Unlisted — accessible via link" />
                ) : (
                  <Lock className="h-4 w-4 text-gray-400" title="Private — only you can see this" />
                )}
              </div>
            </div>

            {/* Format */}
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("text-white text-xs", getFormatColor(deck.format))}>
                {deck.format}
              </Badge>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{totalCards} cards</span>
              {estimatedValue > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ~${estimatedValue.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {deck.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">
            {deck.description}
          </p>
        )}
      </div>

      {/* Deck Composition */}
      <div className="p-4 flex-1">
        <div className="space-y-2">
          {deck.hero && deck.hero.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Hero:</span>
              <span className="font-medium truncate ml-2 text-right">
                {deck.hero[0].printingDetails?.display_name || deck.hero[0].printingDetails?.name || "Unknown"}
              </span>
            </div>
          )}
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
        </div>
      </div>

      {/* Quick Settings + Updated — anchored above action bar */}
      <div className="px-4 pb-4 space-y-2">
        {(onChangeVisibility || onToggleTalishar || (hasMetafyAccount && onUpdateMetafyGuideId)) && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {onChangeVisibility && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">
                  Visibility
                </Label>
                <select
                  value={deck.visibility || 'unlisted'}
                  onChange={(e) => onChangeVisibility(deck.publicId ?? deck._id, e.target.value as 'private' | 'unlisted' | 'public')}
                  className="text-xs h-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            )}
            {onToggleTalishar && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">
                  Available on Talishar
                </Label>
                <TalisharToggle
                  checked={deck.availableOnTalishar ?? false}
                  onChange={(val) => onToggleTalishar(deck.publicId ?? deck._id, val)}
                />
              </div>
            )}
            {isCurator && deck.visibility === 'public' && onToggleFeatured && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">
                  Decks to Beat
                </Label>
                <button
                  role="switch"
                  type="button"
                  aria-checked={deck.featured ?? false}
                  onClick={() => onToggleFeatured(deck.publicId ?? deck._id, !(deck.featured ?? false))}
                  title={deck.featured ? "Remove from Decks to Beat" : "Add to Decks to Beat"}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    deck.featured
                      ? "bg-amber-500 dark:bg-amber-600"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 text-xs ${
                      deck.featured ? "translate-x-5" : "translate-x-0"
                    }`}
                  >
                    <Star className="h-3 w-3 text-amber-500" />
                  </span>
                </button>
              </div>
            )}
            {hasMetafyAccount && onUpdateMetafyGuideId && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                  Metafy Guide ID
                </Label>
                <Input
                  value={metafyGuideIdDraft}
                  onChange={(e) => setMetafyGuideIdDraft(e.target.value)}
                  onBlur={() => onUpdateMetafyGuideId(deck.publicId ?? deck._id, metafyGuideIdDraft.trim() || null)}
                  placeholder="Leave blank to disable"
                  className="h-7 text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Last Updated */}
        <div className="flex items-center gap-1 pt-2 text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="h-3 w-3" />
          <span>Updated {formatDate(deck.updatedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
              title="Edit deck"
            >
              <Edit3 className="h-4 w-4" />
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
          </div>

          <div className="flex gap-1">
            
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
//     <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all duration-200 flex flex-col">
//       {/* Header */}
//       <div className="p-4 border-b border-gray-200 dark:border-gray-700">
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
//       <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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