// components/WhoHasDropdown.tsx

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, ShoppingCart, AlertCircle, ChevronRight, Heart, Package, Grid } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { displayUsername } from '@/lib/utils/display-username';

//=========== INTERFACES ===========//

interface WhoHasDropdownProps {
  cardName: string;
  className?: string;
  printingId?: string;
  cardUniqueId?: string;
  searchMode?: 'printing' | 'unique';
  buttonText?: string;
  /** Restrict owners to people who follow the same stores as the viewer. */
  followedStoresOnly?: boolean;
}

interface Card {
  printing_id: string;
  display_name: string;
  total_quantity: number;
  conditions: Record<string, number>;
  tcg_market?: number;
  tcg_low?: number;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  image_url: string;
}

interface Binder {
  binder_id: string;
  binder_name: string;
  binder_slug: string;
  matching_cards: Card[];
  total_cards_found: number;
  total_value: number;
}

interface Owner {
  user_id: string;
  username: string;
  discord_id?: string;
  avatar_url?: string;
  binders: Binder[];
  total_cards_found: number;
  total_value: number;
  unique_printings_found: number;
}

interface WhoHasResponse {
  success: boolean;
  summary: {
    total_owners_found: number;
    total_cards_found: number;
    total_value_found: number;
    unique_printings_found: number;
  };
  owners: Owner[];
  error?: string;
}


//=========== SUB-COMPONENTS ===========//

function WantMatchBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20">
      {count} card{count !== 1 ? 's' : ''} you want
    </Badge>
  );
}

function BinderDisplay({ binder }: { binder: Binder }) {
  const [expanded, setExpanded] = useState(false);
  const formatConditions = (conditions: Record<string, number>) => Object.entries(conditions).map(([c, q]) => `${q}x ${c}`).join(', ');
  const getConditionColor = (c: Record<string, number>) => c.NM > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="border-l-2 border-gray-100 dark:border-gray-700 ml-2 pl-3 space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={(e) => { e.stopPropagation(); window.location.href = `/binder/${binder.binder_id}`; }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
          <Package className="h-3 w-3" />
          <span>{binder.binder_name}</span>
          <ChevronRight className="h-2.5 w-2.5" />
        </button>
        {binder.matching_cards.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <span>{binder.matching_cards.length} cards</span>
          </button>
        )}
      </div>
      <div className="space-y-1">
        {expanded || binder.matching_cards.length === 1 ? binder.matching_cards.map(c => (
          <div key={c.printing_id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-300">{c.display_name}</span>
              {c.set && <Badge variant="outline" className="text-xs px-1 py-0">{c.set.toUpperCase()}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <span className={getConditionColor(c.conditions)}>{formatConditions(c.conditions)}</span>
              {c.tcg_low && <span className="text-gray-500 dark:text-gray-400">~${(c.tcg_low * c.total_quantity).toFixed(2)}</span>}
            </div>
          </div>
        )) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">{binder.total_cards_found} cards • ~${binder.total_value.toFixed(2)}</div>
        )}
      </div>
    </div>
  );
}

function UserActions({ owner, wantCount, hasWants }: { owner: Owner; wantCount: number; hasWants: boolean }) {
  if (wantCount === 0 && !hasWants) return null;
  return (
    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
      <WantMatchBadge count={wantCount} />
      {hasWants && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/wants/${owner.user_id}`;
          }}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
        >
          <Heart className="h-3 w-3" />
          <span>Wants List</span>
          <ChevronRight className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function EnhancedOwnerDisplay({ owner, wantCount, hasWants }: { owner: Owner; wantCount: number; hasWants: boolean }) {
  return (
    <div className="flex-col items-start p-3 space-y-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {owner.avatar_url ? <img src={owner.avatar_url} alt={owner.username} className="h-5 w-5 rounded-full ring-1 ring-gray-200 dark:ring-gray-600" /> : <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center"><span className="text-xs font-semibold text-white">{displayUsername(owner.username).charAt(0).toUpperCase()}</span></div>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{displayUsername(owner.username)}</span><div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><ShoppingCart className="h-3 w-3" /><span>{owner.total_cards_found}x</span></div></div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{owner.binders.length} binder{owner.binders.length !== 1 ? 's' : ''} • ~${owner.total_value.toFixed(2)}</div>
          </div>
        </div>
      </div>
      <div className="space-y-2 w-full">{owner.binders.map((binder) => <BinderDisplay key={binder.binder_id} binder={binder} />)}</div>
      <UserActions owner={owner} wantCount={wantCount} hasWants={hasWants} />
    </div>
  );
}


//=========== MAIN COMPONENT ===========//

export default function WhoHasDropdown({
  cardName,
  className = "",
  printingId,
  cardUniqueId,
  searchMode = 'printing',
  buttonText,
  followedStoresOnly = false,
}: WhoHasDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WhoHasResponse | null>(null);
  const [wantCounts, setWantCounts] = useState<Record<string, number>>({});
  const [targetHasWants, setTargetHasWants] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);

  useEffect(() => {
    setIsOpen(false);
    setLoading(false);
    setData(null);
    setWantCounts({});
    setTargetHasWants({});
    setError(null);
    setShowAllUsers(false);
  }, [printingId, cardUniqueId]);

  const fetchWhoHas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = '';
      if (searchMode === 'printing' && printingId) {
        query = `printingIds=${encodeURIComponent(printingId)}`;
      } else if (searchMode === 'unique' && cardUniqueId) {
        query = `cardUniqueIds=${encodeURIComponent(cardUniqueId)}`;
      } else {
        throw new Error('Required ID for the search mode was not provided.');
      }
      const storeFilter = followedStoresOnly ? '&followedStoresOnly=true' : '';
      const response = await fetch(`/api/whohas?${query}&forTradeOnly=true&limit=20${storeFilter}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result: WhoHasResponse = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch data');
      setData(result);

      // Batch-fetch want-match counts for all owners in parallel
      if (result.owners.length > 0) {
        const countEntries = await Promise.all(
          result.owners.map(async (owner) => {
            try {
              const r = await fetch(`/api/trade-match/quick?targetUserId=${owner.user_id}`);
              if (!r.ok) return { userId: owner.user_id, count: 0, hasWants: false };
              const d = await r.json();
              return { userId: owner.user_id, count: d.cards_you_want ?? 0, hasWants: d.target_has_wants ?? false };
            } catch {
              return { userId: owner.user_id, count: 0, hasWants: false };
            }
          })
        );
        setWantCounts(Object.fromEntries(countEntries.map(e => [e.userId, e.count])));
        setTargetHasWants(Object.fromEntries(countEntries.map(e => [e.userId, e.hasWants])));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [printingId, cardUniqueId, searchMode, followedStoresOnly]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !data && !loading) {
      fetchWhoHas();
    }

    // Dispatch custom event to notify carousel about dropdown state
    window.dispatchEvent(new CustomEvent('whoHasDropdownChange', {
      detail: { isOpen: open }
    }));
  };

  const renderContent = () => {
    if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span className="text-sm text-gray-600 dark:text-gray-300">Searching...</span></div>;
    if (error) return <div className="flex items-center py-4 px-3"><AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mr-2 flex-shrink-0" /><span className="text-sm text-red-600 dark:text-red-400">{error}</span></div>;
    if (!data) return <div className="py-6 px-3 text-sm text-gray-500 dark:text-gray-400 text-center">Click to search for owners</div>;
    if (data.summary.total_owners_found === 0) return <div className="py-6 px-3 text-center"><div className="text-sm text-gray-500 dark:text-gray-400 mb-1">No users have this for trade</div><div className="text-xs text-gray-400 dark:text-gray-500">Try checking again later</div></div>;

    // If any owner has a wanted card match, filter to only those owners.
    // If none match (logged out, or no wants overlap), show everyone.
    const anyMatches = Object.values(wantCounts).some(c => c > 0);
    const visibleOwners = (anyMatches
      ? data.owners.filter(o => (wantCounts[o.user_id] ?? 0) > 0)
      : data.owners
    ).sort((a, b) => {
      const aHas = targetHasWants[a.user_id] ? 1 : 0;
      const bHas = targetHasWants[b.user_id] ? 1 : 0;
      return bHas - aHas;
    });

    const displayCount = showAllUsers ? visibleOwners.length : Math.min(5, visibleOwners.length);
    const displayedOwners = visibleOwners.slice(0, displayCount);
    const remainingCount = visibleOwners.length - displayCount;

    return (
      <div className="max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          {visibleOwners.length} user{visibleOwners.length !== 1 ? 's' : ''} have this card
        </DropdownMenuLabel>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {displayedOwners.map((owner) => (
            <EnhancedOwnerDisplay key={owner.user_id} owner={owner} wantCount={wantCounts[owner.user_id] ?? 0} hasWants={targetHasWants[owner.user_id] ?? false} />
          ))}
        </div>
        {remainingCount > 0 && <div className="border-t border-gray-100 dark:border-gray-700 p-2"><button onClick={(e) => { e.stopPropagation(); setShowAllUsers(true); }} className="w-full text-center text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-2">Show {remainingCount} more user{remainingCount !== 1 ? 's' : ''}</button></div>}
      </div>
    );
  };

  const Icon = searchMode === 'printing' ? Users : Grid;
  const title = searchMode === 'printing' ? `See who has this specific printing` : `See who has any version of this card`;

  let triggerElement;
  if (buttonText !== undefined) {
    triggerElement = (
      <button
        className={className}
        title={title}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <Icon className={`w-4 h-4 ${buttonText ? 'mr-2' : ''}`} />
        {buttonText}
      </button>
    );
  } else {
    triggerElement = (
      <button
        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
        title={title}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <Icon className="w-4 h-4 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" />
      </button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{triggerElement}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-[32rem] overflow-hidden p-0 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600" align="end" side="bottom">
        {renderContent()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
