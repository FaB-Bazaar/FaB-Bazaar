//components/collection/BinderCard.tsx
"use client"

import { useState, useEffect } from "react"
import { recalculateRarityCounts } from "@/lib/rarityCounts.ts"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaDiscord } from "react-icons/fa";
import { generateUniqueBinderSlug } from "@/lib/utils";
import { Trash2, SquarePen, Eye, ChevronDown, ChevronUp, Globe, Lock, EyeOff } from "lucide-react";

interface BinderCardProps {
  binder: any
  binders: any[]
  user: any
  isEditing: boolean
  onStartEdit: (binder: any) => void
  onSave: (binder: any, name: string, description: string, tags: string, discordSlug: string, isOnHand: boolean, visibility?: any) => void
  onCancelEdit: () => void
  onDelete: (binder: any) => void
  slugError: string | null
  onSlugChange: (slug: string) => void
}

export function BinderCard({ 
  binder, 
  binders, 
  user, 
  isEditing, 
  onStartEdit, 
  onSave, 
  onCancelEdit, 
  onDelete, 
  slugError,
  onSlugChange 
}: BinderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: binder._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  // Local edit state
  const [localEditName, setLocalEditName] = useState(binder.name);
  const [localEditDescription, setLocalEditDescription] = useState(binder.description || "");
  const [localEditTags, setLocalEditTags] = useState((binder.tags || []).join(", "));
  const [localEditDiscordSlug, setLocalEditDiscordSlug] = useState(binder.discordExternalId || "");
  const [localEditIsOnHand, setLocalEditIsOnHand] = useState(binder.isOnHand ?? false);
  const [showAdvancedVisibility, setShowAdvancedVisibility] = useState(false);
  
  // Visibility state - initialize with defaults for backwards compatibility
  const [localEditVisibility, setLocalEditVisibility] = useState(() => {
    if (binder.visibility) {
      return binder.visibility;
    }
    // Create default visibility based on isPublic for backwards compatibility
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
  
  useEffect(() => {
    if (isEditing) {
      setLocalEditName(binder.name);
      setLocalEditDescription(binder.description || "");
      setLocalEditTags((binder.tags || []).join(", "));
      setLocalEditIsOnHand(binder.isOnHand ?? false);
      
      // Initialize visibility
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
      
      // If missing slug, auto-suggest one
      const currentSlug = binder.slug || binder.discordExternalId;
      if (!currentSlug) {
        const existingSlugs = binders.map(b => b.slug || b.discordExternalId).filter(Boolean);
        setLocalEditDiscordSlug(generateUniqueBinderSlug(binder.name, existingSlugs));
      } else {
        setLocalEditDiscordSlug(currentSlug);
      }
    }
  }, [isEditing, binder, binders]);
  
  const handleVisibilityLevelChange = (level: string) => {
    const newVisibility = { ...localEditVisibility, level };
    
    // Auto-update related permissions based on level
    if (level === 'private') {
      newVisibility.allowInSearch = false;
      newVisibility.allowInMatching = false;
      newVisibility.allowApiExport = false;
      newVisibility.allowWhoHas = false;
      newVisibility.allowWebhooks = false;
    } else if (level === 'public') {
      // Set reasonable defaults for public
      newVisibility.allowInSearch = true;
      newVisibility.allowInMatching = true;
      newVisibility.allowApiExport = true;
      newVisibility.allowWhoHas = true;
      newVisibility.allowWebhooks = true;
    } else if (level === 'unlisted') {
      // Unlisted: visible but not in searches
      newVisibility.allowInSearch = false;
      newVisibility.allowInMatching = true;
      newVisibility.allowApiExport = true;
      newVisibility.allowWhoHas = true;
      newVisibility.allowWebhooks = true;
    }
    
    setLocalEditVisibility(newVisibility);
  };
  
  const handleAdvancedVisibilityChange = (field: string, value: boolean) => {
    setLocalEditVisibility(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleSave = () => {
    onSave(binder, localEditName, localEditDescription, localEditTags, localEditDiscordSlug, localEditIsOnHand, localEditVisibility);
  };
  
  // Helper function to get rarity counts
  function getRarityCounts(binder: any) {
    const cards = binder.cards || [];
    const rarityCounts = recalculateRarityCounts(cards);
    const total = cards.reduce((sum: any, c: any) => {
      let qty = 1;
      if (typeof c.quantity === 'object' && c.quantity?.$numberInt) qty = Number(c.quantity.$numberInt);
      else if (typeof c.quantity === 'number') qty = c.quantity;
      return sum + qty;
    }, 0);
    return {
      total,
      marvel: rarityCounts.V || 0,
      leg: rarityCounts.L || 0,
      maj: rarityCounts.M || 0,
      fab: rarityCounts.F || 0,
      pro: rarityCounts.P || 0,
    };
  }
  
  // Helper function to get visibility info for display
  const getVisibilityInfo = (binder: any) => {
    // For backwards compatibility, check both new visibility and old isPublic
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
  
  const rarityCounts = getRarityCounts(binder);
  const visibilityInfo = getVisibilityInfo(binder);
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 gap-2 min-h-[420px] shadow dark:shadow-gray-900/30 transition-shadow duration-200 hover:shadow-lg dark:hover:shadow-gray-900/50 max-w-lg w-full relative"
    >
      {/* Action buttons in upper right */}
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
          
          {/* Protection for MCP binders */}
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
            <Input value={localEditName} onChange={e => setLocalEditName(e.target.value)} className="mb-1 h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            <Input value={localEditDescription} onChange={e => setLocalEditDescription(e.target.value)} placeholder="Description (optional)" className="mb-1 h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400" />
            <Input value={localEditTags} onChange={e => setLocalEditTags(e.target.value)} placeholder="Tags (comma separated)" className="mb-1 h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400" />
            <Input value={localEditDiscordSlug} onChange={e => {
              setLocalEditDiscordSlug(e.target.value);
              onSlugChange(e.target.value);
            }}
              placeholder="Discord slug (e.g. deckbox1)"
              className={`mb-1 h-8 text-sm font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${!localEditDiscordSlug ? 'border-red-500 dark:border-red-400 ring-2 ring-red-300 dark:ring-red-400' : ''}`}
              maxLength={20}
              pattern="[a-z0-9_\-]{3,20}"
              autoComplete="off"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Binder Slug (for bot commands): 3-20 chars, lowercase, numbers, dashes, underscores.</div>
            {!localEditDiscordSlug && (
              <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-semibold">This binder does not have a binder slug. Please add one to enable Discord bot features.</div>
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
                {localEditVisibility.level === 'public' && "Visible to everyone and appears in searches"}
                {localEditVisibility.level === 'unlisted' && "Visible to everyone but doesn't appear in searches"}
                {localEditVisibility.level === 'private' && "Only visible to you"}
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
                      checked={localEditVisibility.allowWebhooks}
                      onChange={e => handleAdvancedVisibilityChange('allowWebhooks', e.target.checked)}
                      className="rounded"
                    />
                    Discord notifications
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
                      checked={localEditVisibility.allowApiExport}
                      onChange={e => handleAdvancedVisibilityChange('allowApiExport', e.target.checked)}
                      className="rounded"
                    />
                    Allow third-party API access
                  </label>
                </div>
              )}
            </div>
            
            <label className="flex items-center gap-2 mt-2 text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={localEditIsOnHand}
                onChange={e => setLocalEditIsOnHand(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span>Is On Hand</span>
            </label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-base cursor-move select-none flex items-center gap-2 text-gray-800 dark:text-gray-100 mb-1" {...attributes} {...listeners} title="Drag to reorder">
              {binder.name}
              {/* Visibility indicator */}
              <span className="flex items-center gap-1 ml-2">
                <visibilityInfo.icon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{visibilityInfo.label}</span>
              </span>
              {/* On Hand indicator */}
              {binder.isOnHand ? (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold border border-green-200 dark:border-green-700">On Hand</span>
              ) : (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-normal border border-gray-200 dark:border-gray-600">Not On Hand</span>
              )}
            </div>
            {binder.description && <div className="text-xs text-gray-600 dark:text-gray-300 mb-1 whitespace-pre-line">{binder.description}</div>}
            {(binder.slug || binder.discordExternalId) && (
              <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 mb-2 mt-0">
                <FaDiscord className="inline-block mr-1" />
                <span>Slug:</span>
                <span className="font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">{binder.slug || binder.discordExternalId}</span>
              </div>
            )}
            {/* Card image preview row */}
            {Array.isArray(binder.cards) && binder.cards.length > 0 && (
              <div className="flex gap-3 mb-2 mt-2">
                {binder.cards.slice(0, 3).map((card: any, idx: number) => (
                  card.printingDetails?.image_url ? (
                    <div key={card._id || card.id || idx} className="w-20 h-30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex items-center justify-center">
                      <Image
                        src={card.printingDetails.image_url}
                        alt={card.name}
                        width={80}
                        height={120}
                        className="object-cover w-full h-full"
                        quality={90}
                        unoptimized={false}
                        priority={idx === 0}
                      />
                    </div>
                  ) : null
                ))}
              </div>
            )}
            <div className="overflow-x-auto mt-1 mb-1">
              <table className="text-xs text-gray-700 dark:text-gray-300 w-auto min-w-max">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th className="px-2 py-1 text-left font-semibold">Total</th>
                    <th className="px-2 py-1 text-left font-semibold">Marvel</th>
                    <th className="px-2 py-1 text-left font-semibold">Leg</th>
                    <th className="px-2 py-1 text-left font-semibold">Maj</th>
                    <th className="px-2 py-1 text-left font-semibold">Fab</th>
                    <th className="px-2 py-1 text-left font-semibold">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2 py-1">{rarityCounts.total}</td>
                    <td className="px-2 py-1">{rarityCounts.marvel}</td>
                    <td className="px-2 py-1">{rarityCounts.leg}</td>
                    <td className="px-2 py-1">{rarityCounts.maj}</td>
                    <td className="px-2 py-1">{rarityCounts.fab}</td>
                    <td className="px-2 py-1">{rarityCounts.pro}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{getRarityCounts(binder).total} cards</div>
            <div className="flex flex-wrap gap-1 mt-0">
              {binder.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{tag}</Badge>
              ))}
            </div>
          </>
        )}
      </div>
      {/* Only show View button at the bottom */}
      <div className="flex gap-1 items-center mt-4">
        <Link href={`/binder/${binder._id}`}>
          <Button variant="default" size="lg" className="h-11 px-6 w-full flex items-center justify-center gap-2 text-base font-semibold shadow-md dark:shadow-gray-900/50">
            <Eye className="h-5 w-5 mr-2" />
            View Binder
          </Button>
        </Link>
      </div>
    </div>
  );
}