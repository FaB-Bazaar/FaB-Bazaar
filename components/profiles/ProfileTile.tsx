//components/profiles/ProfileTile.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Globe, Lock, EyeOff, Star, BarChart3 } from "lucide-react";
import { RarityIcon } from "@/components/shared/RarityIcon";

// Updated interface to match new binder stats structure
interface ProfileBinderData {
  _id: string;
  name: string;
  description?: string;
  tags?: string[];
  slug?: string;
  isOnHand?: boolean;
  visibility?: {
    level: 'public' | 'private' | 'unlisted';
    [key: string]: any;
  };
  isPublic?: boolean;
  
  totalQuantity?: number;
  quantityForTrade?: number;
  quantityNotForTrade?: number;
  totalValue?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueNotForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  rarityCounts?: Record<string, number>;
  rarityCountsForTrade?: Record<string, number>;
  rarityCountsNotForTrade?: Record<string, number>;
  
  showcaseCards?: Array<{
    printingId: string;
    image_url?: string;
    tcg_low: number | { $numberDouble: string };  // Changed from tcg_market
    rarity: string;
  }>;
  
  // OLD STATS FIELDS (backward compatibility)
  total_value?: number;
  cardCount?: number;
  totalCards?: number;
}

interface ProfileTileProps {
  binder: ProfileBinderData;
}

// Helper structure for displaying rarities in order
const RARITY_DISPLAY_ORDER = [
  { key: 'fabled', label: 'Fabled', apiKeys: ['f', 'F'], rarityCode: 'F' },
  { key: 'legendary', label: 'Legendary', apiKeys: ['l', 'L'], rarityCode: 'L' },
  { key: 'majestic', label: 'Majestic', apiKeys: ['m', 'M'], rarityCode: 'M' },
  { key: 'superRare', label: 'Super Rare', apiKeys: ['s', 'S'], rarityCode: 'S' },
  { key: 'rare', label: 'Rare', apiKeys: ['r', 'R'], rarityCode: 'R' },
  { key: 'common', label: 'Common', apiKeys: ['c', 'C'], rarityCode: 'C' },
  { key: 'token', label: 'Token', apiKeys: ['t', 'T'], rarityCode: 'T' },
  { key: 'marvel', label: 'Marvel', apiKeys: ['v', 'V'], rarityCode: 'V' },
  { key: 'promo', label: 'Promo', apiKeys: ['p', 'P'], rarityCode: 'P' },
];

// Fallback colored dots if RarityIcon fails
const RARITY_COLORS = {
  'F': '#f97316', // orange-500 for Fabled
  'L': '#eab308', // yellow-500 for Legendary  
  'M': '#ef4444', // red-500 for Majestic
  'S': '#a855f7', // purple-500 for Super Rare
  'R': '#3b82f6', // blue-500 for Rare
  'C': '#6b7280', // gray-500 for Common
  'T': '#22c55e', // green-500 for Token
  'V': '#ec4899', // pink-500 for Marvel
  'P': '#6366f1', // indigo-500 for Promo
};

// Cloudflare image URL helper
const getShowcaseImageUrl = (printingId: string) => 
  `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`;

// Safe RarityIcon wrapper with fallback
function SafeRarityIcon({ rarityCode, size = "sm" }: { rarityCode: string; size?: string }) {
  try {
    return <RarityIcon rarityCode={rarityCode} size={size} />;
  } catch (error) {
    // Fallback to colored dot if RarityIcon fails
    const color = RARITY_COLORS[rarityCode] || '#6b7280';
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return (
      <div 
        className={`${sizeClass} rounded-full`}
        style={{ backgroundColor: color }}
        title={rarityCode}
      />
    );
  }
}

export function ProfileTile({ binder }: ProfileTileProps) {
  // Helper function to get visibility info for display
  const getVisibilityInfo = (binder: ProfileBinderData) => {
    const visibility = binder.visibility;
    const isPublic = binder.isPublic;
    
    if (visibility) {
      return {
        level: visibility.level,
        icon: visibility.level === 'public' ? Globe : visibility.level === 'private' ? Lock : EyeOff,
        label: visibility.level.charAt(0).toUpperCase() + visibility.level.slice(1)
      };
    }
    
    // Fallback to isPublic for backwards compatibility
    return {
      level: isPublic ? 'public' : 'private',
      icon: isPublic ? Globe : Lock,
      label: isPublic ? 'Public' : 'Private'
    };
  };
  
  // Helper function to format card counts and values for display
  const getDisplayStats = (binder: ProfileBinderData) => {
    // Use new stats fields first, fallback to old ones - ensure we always get numbers
    const totalQuantity = Number(binder.totalQuantity) || Number(binder.cardCount) || Number(binder.totalCards) || 0;
    const totalValue = Number(binder.totalValue?.tcg_low) || Number(binder.total_value) || 0;

    // For trade breakdown - ensure we always get numbers
    const quantityForTrade = Number(binder.quantityForTrade) || 0;
    const quantityNotForTrade = Number(binder.quantityNotForTrade) || 0;
    const valueForTrade = Number(binder.valueForTrade?.tcg_low) || 0;
    const valueNotForTrade = Number(binder.valueNotForTrade?.tcg_low) || 0;
    
    return {
      // Total stats - all guaranteed to be numbers
      totalCards: totalQuantity,
      totalValue: totalValue,

      // Trade breakdown - all guaranteed to be numbers
      cardsForTrade: quantityForTrade,
      cardsNotForTrade: quantityNotForTrade,
      valueForTrade: valueForTrade,
      valueNotForTrade: valueNotForTrade,
      
      // Rarity breakdown for trade
      rarityCountsForTrade: binder.rarityCountsForTrade || {},
      rarityCountsNotForTrade: binder.rarityCountsNotForTrade || {}
    };
  };
  
  const displayStats = getDisplayStats(binder);
  const visibilityInfo = getVisibilityInfo(binder);
  
  return (
    <div className="flex flex-col border-2 border-gray-300 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 gap-2 min-h-[420px] shadow dark:shadow-gray-900/30 transition-shadow duration-200 hover:shadow-lg dark:hover:shadow-gray-900/50 max-w-lg w-full">
      
      <div className="flex flex-col gap-1 flex-1">
        {/* DISPLAY VIEW - READ-ONLY VERSION */}
        <div className="font-semibold text-base flex items-center gap-2 text-gray-800 dark:text-gray-100 mb-2">
          {binder.name}
          <span className="flex items-center gap-1 ml-2">
            <visibilityInfo.icon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">{visibilityInfo.label}</span>
          </span>
          {binder.isOnHand ? (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold border border-green-200 dark:border-green-700">On Hand</span>
          ) : (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-normal border border-gray-300 dark:border-gray-600">Not On Hand</span>
          )}
        </div>

        {binder.description && (
          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 whitespace-pre-line">{binder.description}</div>
        )}

        {/* TABBED CONTENT */}
        <Tabs defaultValue="showcase" className="w-full flex-1">
          <TabsList className="grid w-full grid-cols-2 mb-3 h-8">
            <TabsTrigger value="showcase" className="text-xs flex items-center gap-1">
              <Star className="h-3 w-3" />
              Showcase
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Stats
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="showcase" className="mt-0 flex-1">
            {/* SHOWCASE CARDS VIEW */}
            {binder.showcaseCards && binder.showcaseCards.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  Top {Math.min(binder.showcaseCards.length, 6)} most valuable cards
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {binder.showcaseCards.slice(0, 6).map((card, idx) => {
                    
                    return (
                      <div key={card.printingId} className="aspect-[2/3] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 relative">
                        <Image
                          src={card.image_url || getShowcaseImageUrl(card.printingId)}
                          alt={`${card.rarity}`}
                          fill
                          className="object-cover"
                          quality={90}
                          priority={idx === 0}
                        />
                        {/* Rarity badge */}
                        <div className="absolute top-1 right-1 bg-black/75 text-white text-xs px-1 py-0.5 rounded">
                          {card.rarity.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    ${displayStats.totalValue.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Total Collection Value • {displayStats.totalCards} cards
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
                <Star className="h-8 w-8 mb-2" />
                <div className="text-sm text-center">No showcase cards yet</div>
                <div className="text-xs text-center">Add valuable cards to see them here</div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stats" className="mt-0 flex-1">
            {/* DETAILED STATS VIEW */}
            <div className="text-gray-700 dark:text-gray-300">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="py-1 pr-2 font-semibold">Rarity</th>
                    <th className="py-1 px-2 font-semibold text-center text-green-600 dark:text-green-400">For Trade</th>
                    <th className="py-1 px-2 font-semibold text-center text-gray-500 dark:text-gray-400">Not For Trade</th>
                    <th className="py-1 pl-2 font-semibold text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {RARITY_DISPLAY_ORDER.map(rarity => {
                    const forTradeCount = rarity.apiKeys.reduce((sum, key) => sum + (displayStats.rarityCountsForTrade[key] || 0), 0);
                    const notForTradeCount = rarity.apiKeys.reduce((sum, key) => sum + (displayStats.rarityCountsNotForTrade[key] || 0), 0);
                    const totalCount = forTradeCount + notForTradeCount;

                    if (totalCount === 0) return null;

                    return (
                      <tr key={rarity.key} className="border-b border-gray-300 dark:border-gray-700">
                        <td className="py-1 pr-2 font-medium">
                          <div className="flex items-center gap-2">
                            <SafeRarityIcon rarityCode={rarity.rarityCode} size="sm" />
                            <span>{rarity.label}</span>
                          </div>
                        </td>
                        <td className="py-1 px-2 text-center">{forTradeCount}</td>
                        <td className="py-1 px-2 text-center">{notForTradeCount}</td>
                        <td className="py-1 pl-2 text-center font-semibold">{totalCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-gray-300 dark:border-gray-500">
                    <td className="pt-2 pr-2">Total Cards</td>
                    <td className="pt-2 px-2 text-center">{displayStats.cardsForTrade}</td>
                    <td className="pt-2 px-2 text-center">{displayStats.cardsNotForTrade}</td>
                    <td className="pt-2 pl-2 text-center">{displayStats.totalCards}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-1 pr-2">TCG Low Value</td>
                    <td className="py-1 px-2 text-center text-green-600 dark:text-green-400">${displayStats.valueForTrade.toFixed(2)}</td>
                    <td className="py-1 px-2 text-center text-gray-500 dark:text-gray-400">${displayStats.valueNotForTrade.toFixed(2)}</td>
                    <td className="py-1 pl-2 text-center">${displayStats.totalValue.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
          {binder.tags?.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{tag}</Badge>
          ))}
        </div>
      </div>

      {/* View button at the bottom */}
      <div className="flex gap-1 items-center mt-4">
        <Link href={`/binder/${binder._id}`} legacyBehavior>
          <a className="w-full">
            <Button variant="default" size="lg" className="h-11 px-6 w-full flex items-center justify-center gap-2 text-base font-semibold shadow-md dark:shadow-gray-900/50">
              <Eye className="h-5 w-5 mr-2" />
              View Binder
            </Button>
          </a>
        </Link>
      </div>
    </div>
  );
}