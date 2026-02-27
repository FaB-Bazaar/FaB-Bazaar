"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaDiscord } from "react-icons/fa";
import { generateUniqueBinderSlug } from "@/lib/utils";
import { Trash2, SquarePen, Eye, ChevronDown, ChevronUp, Globe, Lock, EyeOff, Star, BarChart3, ArrowRightLeft } from "lucide-react";
import { RarityIcon } from "@/components/shared/RarityIcon";

interface BinderWithStats {
  _id: string;
  name: string;
  description?: string;
  tags?: string[];
  slug?: string;
  discordExternalId?: string;
  discordUsername?: string;
  isOnHand?: boolean;
  visibility?: any;
  isPublic?: boolean;
  
  // NEW STATS FIELDS (from inventory_items aggregation)
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
  
  // NEW: Showcase cards
  showcaseCards?: Array<{
    printingId: string;
    tcg_low: number;  
    rarity: string;
  }>;
  
  // OLD STATS FIELDS (backward compatibility)
  total_value?: number;
  total_cards_with_pricing?: number;
  total_cards_without_pricing?: number;
  
  // Sample cards for preview (fallback)
  sampleCards?: Array<{
    _id: string;
    name: string;
    display_name: string;
    image_url?: string;
    printingId: string;
  }>;
}

interface CollectionTileProps {
  binder: BinderWithStats
  binders: BinderWithStats[]
  user: any
  isEditing: boolean
  onStartEdit: (binder: BinderWithStats) => void
  onSave: (binder: BinderWithStats, name: string, description: string, tags: string, discordSlug: string, isOnHand: boolean, visibility?: any) => void
  onCancelEdit: () => void
  onDelete: (binder: BinderWithStats) => void
  onTransfer?: (binder: BinderWithStats) => void
  slugError: string | null
  onSlugChange: (slug: string) => void
}

// Helper structure for displaying rarities in order
const RARITY_DISPLAY_ORDER = [
  { key: 'marvel', label: 'Marvel', apiKeys: ['v', 'V'] },
  { key: 'fabled', label: 'Fabled', apiKeys: ['f', 'F'] },
  { key: 'legendary', label: 'Legendary', apiKeys: ['l', 'L'] },
  { key: 'majestic', label: 'Majestic', apiKeys: ['m', 'M'] },
  { key: 'promo', label: 'Promo', apiKeys: ['p', 'P'] },
  { key: 'superRare', label: 'Super Rare', apiKeys: ['s', 'S'] },
  { key: 'rare', label: 'Rare', apiKeys: ['r', 'R'] },
  { key: 'common', label: 'Common', apiKeys: ['c', 'C'] },
  { key: 'token', label: 'Token', apiKeys: ['t', 'T'] },
];

// Cloudflare image URL helper
const getShowcaseImageUrl = (printingId: string) => 
  `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`;

export function CollectionTile({
  binder,
  binders,
  user,
  isEditing,
  onStartEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onTransfer,
  slugError,
  onSlugChange
}: CollectionTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: binder._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  // Local edit state (same as before)
  const [localEditName, setLocalEditName] = useState(binder.name);
  const [localEditDescription, setLocalEditDescription] = useState(binder.description || "");
  const [localEditTags, setLocalEditTags] = useState((binder.tags || []).join(", "));
  const [localEditDiscordSlug, setLocalEditDiscordSlug] = useState(binder.discordExternalId || "");
  const [localEditIsOnHand, setLocalEditIsOnHand] = useState(binder.isOnHand ?? false);
  const [showAdvancedVisibility, setShowAdvancedVisibility] = useState(false);
  
  // Visibility state (same as before)
  const [localEditVisibility, setLocalEditVisibility] = useState(() => {
    if (binder.visibility) {
      return binder.visibility;
    }
    const isPublic = binder.isPublic ?? true;
    return {
      level: isPublic ? 'public' : 'private',
      allowInSearch: isPublic,
      allowInMatching: isPublic,
      allowApiExport: isPublic,
      allowWhoHas: isPublic,
      allowWebhooks: isPublic
    };
  });
  
  // [Previous useEffect and handler functions remain the same...]
  useEffect(() => {
    if (isEditing) {
      setLocalEditName(binder.name);
      setLocalEditDescription(binder.description || "");
      setLocalEditTags((binder.tags || []).join(", "));
      setLocalEditIsOnHand(binder.isOnHand ?? false);
      
      if (binder.visibility) {
        setLocalEditVisibility(binder.visibility);
      } else {
        const isPublic = binder.isPublic ?? true;
        setLocalEditVisibility({
          level: isPublic ? 'public' : 'private',
          allowInSearch: isPublic,
          allowInMatching: isPublic,
          allowApiExport: isPublic,
          allowWhoHas: isPublic,
          allowWebhooks: isPublic
        });
      }
      
      const currentSlug = binder.slug || binder.discordExternalId;
      if (!currentSlug) {
        const existingSlugs = binders.map(b => b.slug || b.discordExternalId).filter(Boolean);
        setLocalEditDiscordSlug(generateUniqueBinderSlug(binder.name, existingSlugs));
      } else {
        setLocalEditDiscordSlug(currentSlug);
      }
    }
  }, [isEditing, binder, binders]);
  
  // [Handler functions remain the same...]
  const handleVisibilityLevelChange = (level: string) => {
    const newVisibility = { ...localEditVisibility, level };
    if (level === 'private') {
      newVisibility.allowInSearch = false;
      newVisibility.allowInMatching = false;
      newVisibility.allowApiExport = false;
      newVisibility.allowWhoHas = false;
      newVisibility.allowWebhooks = false;
    } else if (level === 'public') {
      newVisibility.allowInSearch = true;
      newVisibility.allowInMatching = true;
      newVisibility.allowApiExport = true;
      newVisibility.allowWhoHas = true;
      newVisibility.allowWebhooks = true;
    } else if (level === 'unlisted') {
      newVisibility.allowInSearch = false;
      newVisibility.allowInMatching = true;
      newVisibility.allowApiExport = true;
      newVisibility.allowWhoHas = true;
      newVisibility.allowWebhooks = true;
    }
    setLocalEditVisibility(newVisibility);
  };
  
  const handleAdvancedVisibilityChange = (field: string, value: boolean) => {
    setLocalEditVisibility(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSave = () => {
    onSave(binder, localEditName, localEditDescription, localEditTags, localEditDiscordSlug, localEditIsOnHand, localEditVisibility);
  };
  
  // Helper functions (same as before)
  const getVisibilityInfo = (binder: BinderWithStats) => {
    const visibility = binder.visibility;
    const isPublic = binder.isPublic;
    
    if (visibility) {
      return {
        level: visibility.level,
        icon: visibility.level === 'public' ? Globe : visibility.level === 'private' ? Lock : EyeOff,
        label: visibility.level.charAt(0).toUpperCase() + visibility.level.slice(1)
      };
    }
    
    return {
      level: isPublic ? 'public' : 'private',
      icon: isPublic ? Globe : Lock,
      label: isPublic ? 'Public' : 'Private'
    };
  };
  
  const getDisplayStats = (binder: BinderWithStats) => {
    const totalQuantity = binder.totalQuantity ?? 0;
    const totalValue = binder.totalValue?.tcg_low ?? binder.total_value ?? 0;
    const marketValue = binder.totalValue?.tcg_market ?? 0;
    const quantityForTrade = binder.quantityForTrade ?? 0;
    const quantityNotForTrade = binder.quantityNotForTrade ?? 0;
    const valueForTrade = binder.valueForTrade?.tcg_low ?? 0;
    const valueNotForTrade = binder.valueNotForTrade?.tcg_low ?? 0;
    
    return {
      totalCards: totalQuantity,
      totalValue: totalValue,
      marketValue: marketValue,
      cardsForTrade: quantityForTrade,
      cardsNotForTrade: quantityNotForTrade,
      valueForTrade: valueForTrade,
      valueNotForTrade: valueNotForTrade,
      rarityCountsForTrade: binder.rarityCountsForTrade ?? {},
      rarityCountsNotForTrade: binder.rarityCountsNotForTrade ?? {}
    };
  };
  
  const displayStats = getDisplayStats(binder);
  const visibilityInfo = getVisibilityInfo(binder);
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 gap-2 min-h-[420px] shadow dark:shadow-gray-900/30 transition-shadow duration-200 hover:shadow-lg dark:hover:shadow-gray-900/50 max-w-lg w-full relative"
    >
      {/* Action buttons in upper right (same as before) */}
      {!isEditing && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-gray-100 h-8 w-8 no-select"
            onClick={() => onStartEdit(binder)}
            title="Edit Binder"
            type="button"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          
          {binder.slug !== 'mcp-binder' && (
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground dark:hover:bg-red-900 dark:hover:text-red-100 text-red-500 dark:text-red-400 h-8 w-8 no-select"
              onClick={() => onDelete(binder)}
              title="Delete Binder"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      
      <div className="flex flex-col gap-1 flex-1">
        {isEditing ? (
         <>
            {/* ======================================================================== */}
            {/*        *** THIS IS THE RESTORED EDITING VIEW ***                      */}
            {/* ======================================================================== */}
            <Input value={localEditName} onChange={e => setLocalEditName(e.target.value)} className="mb-1 h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            <Input value={localEditDescription} onChange={e => setLocalEditDescription(e.target.value)} placeholder="Description (optional)" className="mb-1 h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400" />
            <Input value={localEditTags} onChange={e => setLocalEditTags(e.target.value)} placeholder="Tags (comma separated)" className="mb-1 h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400" />
            <Input 
              value={localEditDiscordSlug} 
              onChange={e => { setLocalEditDiscordSlug(e.target.value); onSlugChange(e.target.value); }}
              placeholder="Discord slug (e.g. deckbox1)"
              className={`mb-1 h-8 text-sm font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${!localEditDiscordSlug ? 'border-red-500 dark:border-red-400 ring-2 ring-red-300 dark:ring-red-400' : ''}`}
              maxLength={20}
              pattern="[a-z0-9_\\-]{3,20}"
              autoComplete="off"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Slug: 3-20 chars, lowercase, numbers, -, _</div>
            {!localEditDiscordSlug && (
              <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-semibold">A slug is required for Discord bot features.</div>
            )}
            {slugError && <div className="text-xs text-red-600 dark:text-red-400 mb-1">{slugError}</div>}
            
            {/* Visibility Controls */}
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visibility:</label>
                <select 
                  value={localEditVisibility.level}
                  onChange={e => handleVisibilityLevelChange(e.target.value)}
                  className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {localEditVisibility.level === 'public' && "Visible to everyone and appears in searches."}
                {localEditVisibility.level === 'unlisted' && "Visible via link but not in public searches."}
                {localEditVisibility.level === 'private' && "Only visible to you."}
              </div>
              
              {/* Advanced Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvancedVisibility(!showAdvancedVisibility)}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {showAdvancedVisibility ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Advanced Privacy Settings
              </button>
              
             {/* Advanced Settings Panel */}
              {showAdvancedVisibility && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-600">
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={localEditVisibility.allowInSearch}
                      onChange={e => handleAdvancedVisibilityChange('allowInSearch', e.target.checked)}
                      className="rounded"
                    />
                    Show in card searches
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={localEditVisibility.allowInMatching}
                      onChange={e => handleAdvancedVisibilityChange('allowInMatching', e.target.checked)}
                      className="rounded"
                    />
                    Allow trade matching
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input 
                      type="checkbox" 
                      checked={localEditVisibility.allowWhoHas} 
                      onChange={e => handleAdvancedVisibilityChange('allowWhoHas', e.target.checked)} 
                      className="rounded" 
                    />
                    Show in "who has" queries
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input 
                      type="checkbox" 
                      checked={localEditVisibility.allowWebhooks} 
                      onChange={e => handleAdvancedVisibilityChange('allowWebhooks', e.target.checked)} 
                      className="rounded" 
                    />
                    Allow webhooks
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input 
                      type="checkbox" 
                      checked={localEditVisibility.allowApiExport} 
                      onChange={e => handleAdvancedVisibilityChange('allowApiExport', e.target.checked)} 
                      className="rounded" 
                    />
                    Allow API access
                  </label>
                </div>
              )}
            </div>
            
            <label className="flex items-center gap-2 mt-2 text-gray-700 dark:text-gray-300 text-sm">
              <input type="checkbox" checked={localEditIsOnHand} onChange={e => setLocalEditIsOnHand(e.target.checked)} className="dark:bg-gray-700 dark:border-gray-600 rounded" />
              <span>Is On Hand</span>
            </label>
            
            <div className="flex gap-2 mt-auto pt-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            {/* DISPLAY VIEW - YOUR NEW UI IS PRESERVED HERE */}
            <div className="font-semibold text-base cursor-move select-none flex items-center gap-2 text-gray-800 dark:text-gray-100 mb-2" {...attributes} {...listeners} title="Drag to reorder">
              {binder.name}
              <span className="flex items-center gap-1 ml-2">
                <visibilityInfo.icon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{visibilityInfo.label}</span>
              </span>
              {binder.isOnHand ? (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold border border-green-200 dark:border-green-700">On Hand</span>
              ) : (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-normal border border-gray-200 dark:border-gray-600">Not On Hand</span>
              )}
            </div>

            {binder.description && <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 whitespace-pre-line">{binder.description}</div>}
            
            {(binder.slug || binder.discordExternalId) && (
              <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 mb-2">
                <FaDiscord className="inline-block mr-1" />
                <span>Slug:</span>
                <span className="font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">{binder.slug || binder.discordExternalId}</span>
              </div>
            )}

            {/* NEW TABBED CONTENT */}
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
                      Top {binder.showcaseCards.length} most valuable cards
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {binder.showcaseCards.map((card, idx) => (
                        <div key={card.printingId} className="aspect-[2/3] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 relative">
                          <Image
                            src={getShowcaseImageUrl(card.printingId)}
                            alt={`${card.rarity} card worth $${card.tcg_low || card.tcg_market || 0}`}
                            fill
                            className="object-cover"
                            quality={90}
                            priority={idx === 0}
                          />
                          {/* Price overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center">
                            ${(card.tcg_low || card.tcg_market || 0).toFixed(0)}
                          </div>
                          {/* Rarity badge */}
                          <div className="absolute top-1 right-1 bg-black/75 text-white text-xs px-1 py-0.5 rounded">
                            {card.rarity.toUpperCase()}
                          </div>
                        </div>
                      ))}
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
                {/* DETAILED STATS VIEW - Same table as before */}
                <div className="text-gray-700 dark:text-gray-300">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-gray-200 dark:border-gray-600">
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
                          <tr key={rarity.key} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="py-1 pr-2 font-medium flex items-center gap-2">
                               <RarityIcon rarityCode={rarity.apiKeys[0]} size="sm" />
                               <span>{rarity.label}</span>
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

            {/* Tags (same as before) */}
            <div className="flex flex-wrap gap-1 mt-auto pt-2">
              {binder.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{tag}</Badge>
              ))}
            </div>
          </>
        )}
      </div>

      {/* View button at the bottom */}
      <div className="flex gap-2 items-center mt-4">
        <Link href={`/binder/${binder._id}`} legacyBehavior>
          <a className="flex-1">
            <Button variant="default" size="lg" className="h-11 px-6 w-full flex items-center justify-center gap-2 text-base font-semibold shadow-md dark:shadow-gray-900/50">
              <Eye className="h-5 w-5 mr-2" />
              View Binder
            </Button>
          </a>
        </Link>
        {onTransfer && displayStats.totalCards > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => onTransfer(binder)}
            className="h-11 px-4 flex items-center justify-center gap-2 shadow-md dark:shadow-gray-900/50"
            title="Transfer all cards to another binder"
          >
            <ArrowRightLeft className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}