"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, Search, List, X, Swords, LayoutGrid, Eye, Sparkles, Trophy, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, ExternalLink, Settings, Copy, Download, Check, Tv, FileText, MoreHorizontal, Plus, Minus } from "lucide-react";
import { type PackageSplit, defaultSplit, benchQty as splitBenchQty, addCopy, removeCopy, allToDeck, allToInventory, allToBench, splitToItems } from "@/lib/deck/package-split";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeckEditor } from "@/hooks/deck/useDeckEditor";
import type { SwapTarget } from "@/hooks/deck/useDeckEditor";
import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";
import { decksClient } from "@/lib/client";
import { deckFormatToBannedFormat, fetchBannedCardsForFormat, invalidateBannedCardsCache } from "@/lib/client/banned-cards-client";
import DeckEditorSidebar from "@/components/deck/editor/DeckEditorSidebar";
import DeckEditorListView from "@/components/deck/editor/DeckEditorListView";
import { computeDeckSectionCounts } from "@/components/deck/editor/deck-section-counts";
import { DeckStatsPopover } from "@/components/deck/editor/DeckStatsPopover";
import { useDeckCommandHud } from "@/components/deck/editor/useDeckCommandHud";
import { useBinderWantsActions } from "@/hooks/deck/useBinderWantsActions";
import { useDeckOptions } from "@/hooks/deck/useDeckOptions";
import DeckToolbarMoreMenu from "@/components/deck/editor/DeckToolbarMoreMenu";
import MobileDeckActionsSheet from "@/components/deck/mobile/MobileDeckActionsSheet";
import DeckRightRail from "@/components/deck/editor/DeckRightRail";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import OmensReleaseNotice from "@/components/deck/OmensReleaseNotice";
import DeckResultsTab from "@/components/deck/DeckResultsTab";
import DeckNotesTab from "@/components/deck/DeckNotesTab";
import QuickAddCardDialog from "@/components/deck/editor/QuickAddCardDialog";
import { getHeroInfo } from "@/lib/fab-constants";
import { OFFICIAL_TALENTS } from "@/lib/talent-constants";
import MobileCardSearch from "@/components/deck/editor/MobileCardSearch";
import EmptyDeckHero from "@/components/deck/editor/build-progress/EmptyDeckHero";
import { useBuildProgress } from "@/hooks/deck/useBuildProgress";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useIsMac } from "@/components/ui/use-client-env";
import { resolveQuickAddAction, type QuickAddTarget } from "@/lib/deck/quickAddRouting";
import type { MobileAddZone } from "@/lib/deck/mobile-add-zone";
import { resolveDefaultDeckViewMode } from "@/lib/deck/deckViewMode";
import BulkImportForm from "@/components/browse/BulkImportForm";
import BulkResultsGrid from "@/components/browse/BulkResultsGrid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ViewPrintingsDialog from "@/components/dialogs/cards/view-printings-dialog";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { trackDeckView } from "@/lib/gtag";

interface PackageCard {
  printingId: string;
  displayName?: string;
  color?: string;
  setCode?: string;
  imageUrl?: string;
  comment?: string | null;
}

function PackageCardItem({
  card,
  split,
  onSplitChange,
  adding,
  addingInventory,
  addingBench,
  isOwner,
  inDeck,
  comment,
  onAdd,
  onAddToInventory,
  onAddToBench,
}: {
  card: PackageCard;
  /** Deck / inventory allocation + the total to import (see lib/deck/package-split). */
  split: PackageSplit;
  onSplitChange: (next: PackageSplit) => void;
  adding: boolean;
  addingInventory: boolean;
  addingBench: boolean;
  isOwner: boolean;
  inDeck?: number;
  comment?: string;
  onAdd: (qty: number) => void;
  onAddToInventory: (qty: number) => void;
  onAddToBench: (qty: number) => void;
}) {
  const { deck: deckQty, inventory: inventoryQty, total } = split;
  const benchQty = splitBenchQty(split);
  const busy = adding || addingInventory || addingBench;
  const onDeckQtyChange = (deck: number, inventory = inventoryQty) => onSplitChange({ ...split, deck, inventory });
  const onInventoryQtyChange = (inventory: number, deck = deckQty) => onSplitChange({ ...split, deck, inventory });

  const handleAdd = () => {
    if (deckQty > 0) onAdd(deckQty);
    if (inventoryQty > 0) onAddToInventory(inventoryQty);
    if (benchQty > 0) onAddToBench(benchQty);
  };

  return (
    <div className="flex flex-col items-center gap-2 h-full">
      <img
        src={card.imageUrl || "/cardback.webp"}
        alt={card.displayName ?? card.printingId}
        className="w-full rounded-lg shadow-md"
      />
      <span className="text-gray-300 text-xs text-center leading-tight">
        {card.displayName ?? card.printingId}
      </span>
      {comment && (
        <p className="text-gray-400 text-xs text-center leading-snug italic px-1">{comment}</p>
      )}
      {inDeck != null && inDeck > 0 && (
        <span className="text-xs text-gray-500">{inDeck} in deck</span>
      )}
      {isOwner && (
        <div className="w-full flex flex-col gap-1 mt-auto">
          {/* Qty row — change how many copies to import (list quantity is only the default).
              + adds a copy to the deck; − takes from bench, then inventory, then deck. */}
          <div className="w-full flex items-center gap-1 pb-1 mb-0.5 border-b border-gray-700/60">
            <span className="text-[10px] text-gray-400 w-8 shrink-0">Qty</span>
            <span className={cn("flex-1 text-center text-xs font-semibold tabular-nums", total > 0 ? "text-gray-200" : "text-gray-600")}>{total}</span>
            <button
              onClick={() => onSplitChange(removeCopy(split))}
              disabled={total === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Remove a copy"
              aria-label="Remove a copy"
            ><Minus className="h-3.5 w-3.5" /></button>
            <button
              onClick={() => onSplitChange(addCopy(split))}
              disabled={busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Add a copy (to deck)"
              aria-label="Add a copy"
            ><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {/* Deck row — ↓ send one to inventory, ↓↓ send one straight to bench */}
          <div className="w-full flex items-center gap-1">
            <span className="text-[10px] text-gray-400 w-8 shrink-0">Deck</span>
            <span className={cn("flex-1 text-center text-xs font-semibold tabular-nums", deckQty > 0 ? "text-blue-400" : "text-gray-600")}>{deckQty}</span>
            <button
              onClick={() => onDeckQtyChange(deckQty - 1, inventoryQty + 1)}
              disabled={deckQty === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Move one to inventory"
            ><ChevronDown className="h-3.5 w-3.5" /></button>
            <button
              onClick={() => onDeckQtyChange(deckQty - 1)}
              disabled={deckQty === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Move one straight to bench"
            ><ChevronsDown className="h-3.5 w-3.5" /></button>
          </div>
          {/* Inventory row — ↑ move one to deck, ↓ move one to bench */}
          <div className="w-full flex items-center gap-1">
            <span className="text-[10px] text-gray-400 w-8 shrink-0">Inv</span>
            <span className={cn("flex-1 text-center text-xs font-semibold tabular-nums", inventoryQty > 0 ? "text-amber-400" : "text-gray-600")}>{inventoryQty}</span>
            <button
              onClick={() => onInventoryQtyChange(inventoryQty - 1, deckQty + 1)}
              disabled={inventoryQty === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Move one to deck"
            ><ChevronUp className="h-3.5 w-3.5" /></button>
            <button
              onClick={() => onInventoryQtyChange(inventoryQty - 1)}
              disabled={inventoryQty === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Move one to bench"
            ><ChevronDown className="h-3.5 w-3.5" /></button>
          </div>
          {/* Bench row — ↑ move one to inventory, ↑↑ move one straight to deck */}
          <div className="w-full flex items-center gap-1">
            <span className="text-[10px] text-gray-500 w-8 shrink-0">Bench</span>
            <span className={cn("flex-1 text-center text-xs font-semibold tabular-nums", benchQty > 0 ? "text-gray-400" : "text-gray-600")}>{benchQty}</span>
            <button
              onClick={() => onInventoryQtyChange(inventoryQty + 1)}
              disabled={benchQty === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Move one to inventory"
            ><ChevronUp className="h-3.5 w-3.5" /></button>
            <button
              onClick={() => onDeckQtyChange(deckQty + 1)}
              disabled={benchQty === 0 || busy}
              className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white flex items-center justify-center shrink-0"
              title="Move one straight to deck"
            ><ChevronsUp className="h-3.5 w-3.5" /></button>
          </div>
          <button
            onClick={handleAdd}
            disabled={busy || total === 0}
            className="w-full mt-0.5 text-xs px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-1"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Add
          </button>
        </div>
      )}
    </div>
  );
}

export default function DeckEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const deckId = params.deckId as string;

  const { state, handlers } = useDeckEditor(deckId);

  // Tab state
  const [activeTab, setActiveTab] = useState<"search" | "deck" | "results" | "notes">("deck");

  // Quick-add dialog state
  const [quickAddTarget, setQuickAddTarget] = useState<{ category: DeckCategory; pitch?: 1 | 2 | 3 } | null>(null);

  const isOwner = !!(user && state.deck && state.deck.userId === user.id);
  const isCoOwner = !!(user && state.deck && !isOwner && (state.deck.coOwners ?? []).includes(user.id));
  const canEdit = isOwner || isCoOwner;

  // Mobile users get the inline Cards tab (MobileCardSearch) instead of the
  // desktop QuickAddCardDialog, whose 390px filter sidebar stacks above the
  // results on narrow viewports.
  const isMobile = useIsMobile();
  // useIsMobile reports false until its mount effect reads matchMedia. The deck
  // view mode locks in on the first non-null defaultViewMode, so hold that back
  // until the viewport is actually known — otherwise phones lock to the desktop
  // default before the media query resolves.
  const [viewportResolved, setViewportResolved] = useState(false);
  useEffect(() => { setViewportResolved(true); }, []);
  // Zone the mobile Cards tab adds to. The desktop dialog reads the zone from
  // quickAddTarget; on phones the tab switch used to drop it, so "+ Bench"
  // added to the maindeck.
  const [mobileAddZone, setMobileAddZone] = useState<MobileAddZone>("maindeck");
  const openQuickAdd = (target: QuickAddTarget) => {
    const action = resolveQuickAddAction(isMobile, target, canEdit);
    if (action.kind === "blocked") return;
    if (action.kind === "switchTab") {
      const c = action.target.category;
      setMobileAddZone(c === "inventory" || c === "benched" ? c : "maindeck");
      setActiveTab(action.tab);
    } else setQuickAddTarget(action.target);
  };

  // Optimistic deck state for instant qty feedback in sidebar
  const [optimisticDeck, setOptimisticDeck] = useState<DeckDTO | null>(null);

  // Binder state

  // Curated builds for this hero
  const [curatedBuilds, setCuratedBuilds] = useState<Array<{
    id: string;
    name: string;
    description?: string | null;
    cards: Array<{ printingId: string; displayName?: string; color?: string; setCode?: string; imageUrl?: string; comment?: string | null }>;
    curatorUser: { username: string; displayUsername: string; avatarUrl: string | null; metafyProductUrl: string | null } | null;
  }>>([]);

  // Search form collapse state
  const [searchFormOpen, setSearchFormOpen] = useState(true);

  // Build progress strip dismissal (session-only — refresh shows it again)
  const [buildProgressDismissed, setBuildProgressDismissed] = useState(false);
  const buildProgress = useBuildProgress(state.deck, state.deck?.format);


  // Options ("More") menu actions + their dialogs — shared with deck v2.
  const {
    setExportImageOpen, exportImageOpen, setSettingsOpen, setStreamOverlayOpen,
    handleCopyList, handleExportList, handleUpgradePrintings, handleConvertLanguage,
    dialogs: optionsDialogs,
  } = useDeckOptions({ deck: state.deck ?? null, deckId, canEdit, isOwner, refreshDeck: handlers.refreshDeck });

  // Mobile actions bottom sheet (header action cluster is desktop-only)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);


  // Banned-card detection (populates after deck + format are known)
  const [bannedCardIds, setBannedCardIds] = useState<Set<string>>(new Set());
  const [switchingFormat, setSwitchingFormat] = useState(false);


  // Tracks whether the one-time auto-search from curated builds has fired
  const autoSearchedRef = useRef(false);

  // Dialog state: for staged card printing swap
  const [activeDialogInstanceId, setActiveDialogInstanceId] = useState<string | null>(null);

  // Dialog state: for deck card printing swap
  const [deckSwapTarget, setDeckSwapTarget] = useState<SwapTarget | null>(null);

  // Deep-link support: /decks/[id]?tab=notes (and ?tab=results) opens that tab
  // directly once we know the viewer can edit. /decks/[id]/notes redirects here.
  useEffect(() => {
    const tab = searchParams.get("tab");
    if ((tab === "notes" || tab === "results") && canEdit) setActiveTab(tab);
  }, [searchParams, canEdit]);

  const stagedCards = state.bulkResults.filter(c => c.isStaged);

  // Hovered card preview shown in the right rail.
  const [hoveredCard, setHoveredCard] = useState<{
    url: string;
    name: string;
    printingId?: string;
    otherFaceUrl?: string;
    tcgplayerUrl?: string;
    tcgLow?: number;
    collectorNumber?: string;
    setCode?: string;
    edition?: string;
    foiling?: string;
    rarity?: string;
    pitch?: number | null;
    cost?: number | null;
    power?: number | null;
    defense?: number | null;
    typeText?: string;
  } | null>(null);

  // Sidebar stats — derived from the deck for the right rail.
  // Average cost is computed over maindeck only (excludes hero/equipment/inventory),
  // matching the conventional "deck cost curve" interpretation.
  const railStats = useMemo(() => {
    const d = state.deck;
    if (!d) return null;
    const all = [...(d.maindeck ?? []), ...(d.equipment ?? []), ...(d.inventory ?? [])];
    let red = 0, yellow = 0, blue = 0, none = 0;
    let owned = 0, total = 0;
    for (const c of all) {
      const qty = c.quantity ?? 1;
      total += qty;
      const ownedQty = state.ownershipMap.get(c.printingId)?.owned ?? 0;
      owned += Math.min(qty, ownedQty);
      const p = c.printingDetails?.pitch;
      if (p === 1) red += qty;
      else if (p === 2) yellow += qty;
      else if (p === 3) blue += qty;
      else none += qty;
    }
    let costSum = 0, costCount = 0;
    for (const c of d.maindeck ?? []) {
      const qty = c.quantity ?? 1;
      const cost = c.printingDetails?.cost;
      if (typeof cost === "number") {
        costSum += cost * qty;
        costCount += qty;
      }
    }
    const averageCost = costCount > 0 ? costSum / costCount : null;
    // Zone counts mirror the tiles-view classification (weapons split from
    // equipment, hero excluded) — see deck-section-counts.ts.
    const sectionCounts = computeDeckSectionCounts(d);
    return { pitchCounts: { red, yellow, blue, none }, averageCost, ownedCount: owned, totalCount: total, sectionCounts };
  }, [state.deck, state.ownershipMap]);

  /** Pitch/cost stat chips. `extras` adds No Pitch + Avg Cost (the desktop
      header row); the mobile row omits them — they live in the Stats popover. */
  const renderPitchChips = (stats: NonNullable<typeof railStats>, extras: boolean) => {
    const totalPitched = stats.pitchCounts.red + stats.pitchCounts.yellow + stats.pitchCounts.blue + (stats.pitchCounts.none ?? 0);
    const pitches = [
      { label: 'Red', count: stats.pitchCounts.red, dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
      { label: 'Yellow', count: stats.pitchCounts.yellow, dot: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
      { label: 'Blue', count: stats.pitchCounts.blue, dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
      ...(extras ? [{ label: 'No Pitch', count: stats.pitchCounts.none ?? 0, dot: 'bg-gray-400', text: 'text-gray-700 dark:text-gray-300' }] : []),
    ].filter(p => p.count > 0);
    return (
      <>
        {totalPitched > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 text-sm">
            <span className="font-semibold tabular-nums">{totalPitched}</span>
            <span className="text-gray-600 dark:text-gray-400">Total</span>
          </span>
        )}
        {pitches.map(p => (
          <span
            key={p.label}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/60 text-sm"
          >
            <span className={cn("w-2 h-2 rounded-full", p.dot)} aria-hidden="true" />
            <span className={cn("font-semibold tabular-nums", p.text)}>{p.count}</span>
            <span className="text-gray-600 dark:text-gray-400">{p.label}</span>
          </span>
        ))}
        {extras && stats.averageCost != null && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 text-sm">
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg Cost</span>
            <span className="font-semibold tabular-nums">{stats.averageCost.toFixed(1)}</span>
          </span>
        )}
      </>
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    await handlers.handleBulkSearch(e);
    setSearchFormOpen(false);
  };

  // Auto-trigger search the first time the user opens the Search tab,
  // if the input was pre-populated from curated builds and no search has run yet.
  useEffect(() => {
    if (activeTab !== 'search' || autoSearchedRef.current || !state.bulkInput || state.bulkResults.length > 0) return;
    autoSearchedRef.current = true;
    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
    handleSearch(syntheticEvent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const activeInstance = state.bulkResults.find(c => c.instanceId === activeDialogInstanceId);

  const handleQuickAddCard = async (printing: any, quantity: number) => {
    if (!quickAddTarget) return;
    const result = await decksClient.addPrintings(deckId, [{ printingId: printing.printing_id, quantity, category: quickAddTarget.category }]);
    // The bulk route answers 200 with per-row outcomes: a legality/copy-cap
    // rejection lives in results[i].error, not the envelope.
    const rowError = result.success
      ? result.data?.results?.find(r => r.printingId === printing.printing_id && !r.success)?.error
      : result.error;
    if (rowError) {
      toast({ title: "Add failed", description: rowError, variant: "destructive" });
      throw new Error(rowError);
    }
    await handlers.refreshDeck();
    // Keep dialog open so user can add more cards
  };

  // Clear optimistic deck once the real deck refreshes from the server
  useEffect(() => { setOptimisticDeck(null); }, [state.deck]);

  // Fire GA deck_view once per page load, when the deck is loaded
  const deckViewTrackedRef = useRef(false);
  useEffect(() => {
    if (deckViewTrackedRef.current || !state.deck) return;
    deckViewTrackedRef.current = true;
    trackDeckView({
      deck_id: deckId,
      deck_name: state.deck.name,
      format: state.deck.format,
      hero: state.deck.heroName,
      is_public: (state.deck as any).isPublic,
    });
  }, [deckId, state.deck]);

  // Fetch banned-card list for the deck's current format (cached client-side).
  useEffect(() => {
    const bannedFormat = deckFormatToBannedFormat(state.deck?.format);
    if (!bannedFormat) { setBannedCardIds(new Set()); return; }
    let cancelled = false;
    fetchBannedCardsForFormat(bannedFormat).then(({ ids }) => {
      if (!cancelled) setBannedCardIds(ids);
    });
    return () => { cancelled = true; };
  }, [state.deck?.format]);

  // Fetch curated builds for this hero (or generic lists if no hero set)
  useEffect(() => {
    if (!state.deck) return;
    const heroName = state.deck.heroName || state.deck.hero?.[0]?.printingDetails?.display_name?.toLowerCase();
    const listsUrl = heroName
      ? `/api/curated-lists?heroName=${encodeURIComponent(heroName)}&view=public`
      : `/api/curated-lists?view=public`;
    setBuildsLoading(true);
    const listsPromise = fetch(listsUrl)
      .then(r => r.json())
      .then(data => { if (data.success) setCuratedBuilds(data.data ?? []); })
      .catch(() => {});
    const curatorsPromise = heroName
      ? fetch(`/api/curator-heroes?heroName=${encodeURIComponent(heroName)}`)
          .then(r => r.json())
          .then(data => {
            if (data.success) setHeroCurators(data.data ?? []);
          })
          .catch(() => {})
      : Promise.resolve();
    Promise.all([listsPromise, curatorsPromise]).finally(() => setBuildsLoading(false));
  }, [state.deck?.heroName, state.deck?._id, state.deck?.hero]);


  // Binders + add-to-binder / add-to-wants (shared with deck v2).
  const { binders, selectedBinderId, handleBinderChange, handleAddToBinder, handleAddToWants } =
    useBinderWantsActions({ user, refreshDeck: handlers.refreshDeck, refreshWants: handlers.refreshWants });

  // ─── Chord keyboard shortcuts (Cmd/Ctrl+K → ...) ───────────────────────────
  // Deck Tools HUD (Cmd/Ctrl+K) — shared with deck v2 (useDeckCommandHud).
  const { chordMode, hud: commandHud, renderToolsTrigger } = useDeckCommandHud({
    deck: state.deck ?? null, deckId, canEdit, openQuickAdd, activeTab, setActiveTab,
  });
  // ────────────────────────────────────────────────────────────────────────────

  // Redirect only when the deck is private and the viewer isn't the owner
  useEffect(() => {
    if (authLoading || state.deckLoading) return;
    if (!state.deck) return;
    const canView = (user && state.deck.userId === user.id) ||
      (user && (state.deck.coOwners ?? []).includes(user.id)) ||
      state.deck.isPublic;
    if (!canView) {
      router.replace(`/decks/${deckId}/analyze`);
    }
  }, [authLoading, state.deckLoading, user, state.deck, deckId, router]);

  // Remove a card from the saved deck — passes a large quantity so the service
  // always deletes the row entirely regardless of how many copies are stored.
  const handleRemoveDeckCard = async (printingId: string, category: DeckCategory) => {
    const result = await decksClient.removePrinting(deckId, printingId, category, 999999);
    if (result.success) {
      await handlers.refreshDeck();
    } else {
      toast({ title: "Remove failed", description: result.error, variant: "destructive" });
    }
  };

  // Remove every printing of a card group from the deck at once
  const handleRemoveGroupFromDeck = async (printingIds: string[], category: DeckCategory) => {
    await Promise.all(
      printingIds.map(printingId => decksClient.removePrinting(deckId, printingId, category, 999999))
    );
    await handlers.refreshDeck();
  };

  // Applies an optimistic qty change to the deck for instant UI feedback
  const applyOptimisticQty = (deck: DeckDTO, printingId: string, newQty: number, category: DeckCategory): DeckDTO => {
    const cards = [...((deck[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) ?? [])];
    const idx = cards.findIndex(c => c.printingId === printingId);
    if (idx === -1) return deck;
    if (newQty <= 0) cards.splice(idx, 1);
    else cards[idx] = { ...cards[idx], quantity: newQty };
    return { ...deck, [category]: cards };
  };

  // Update quantity of a specific printing in the saved deck via a delta —
  // only add or remove the difference. A previous remove-then-readd approach
  // would destroy existing rows when the readd hit copy-limit validation
  // (addPrintings reports per-item failures in results[], not at the top level).
  const handleUpdateDeckCardQty = async (printingId: string, newQty: number, category: DeckCategory) => {
    const base = optimisticDeck ?? state.deck;
    if (!base) return;
    const cards = (base[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) ?? [];
    const currentQty = cards.find(c => c.printingId === printingId)?.quantity ?? 0;
    const delta = newQty - currentQty;
    if (delta === 0) return;

    // Optimistic update — instant feedback, no waiting for API
    setOptimisticDeck(applyOptimisticQty(base, printingId, newQty, category));

    // Always refresh at the end — even on failure, so child views with their
    // own optimistic state (e.g. DeckEditorListView) clear when the deck prop
    // changes back to the true server value.
    let failureMessage: string | null = null;
    if (delta > 0) {
      const addResult = await decksClient.addPrintings(deckId, [{ printingId, quantity: delta, category }]);
      if (!addResult.success) {
        failureMessage = addResult.error;
      } else {
        const itemError = addResult.data?.results?.find(r => r.printingId === printingId && !r.success)?.error;
        if (itemError) failureMessage = itemError;
      }
    } else {
      const removeResult = await decksClient.removePrinting(deckId, printingId, category, -delta);
      if (!removeResult.success) failureMessage = removeResult.error;
    }

    if (failureMessage) {
      setOptimisticDeck(null); // revert page-level optimistic state
      toast({ title: "Update failed", description: failureMessage, variant: "destructive" });
    }
    await handlers.refreshDeck();
  };

  // Move 1 copy of a printing from one category to another.
  // To avoid stacking issues: remove all, re-add (qty-1) to source, add 1 to destination.
  const handleMoveSinglePrinting = async (
    printingId: string,
    fromCategory: DeckCategory,
    toCategory: DeckCategory,
    currentQty: number
  ) => {
    const removeResult = await decksClient.removePrinting(deckId, printingId, fromCategory, 999999);
    if (!removeResult.success) {
      toast({ title: "Move failed", description: removeResult.error, variant: "destructive" });
      return;
    }
    if (currentQty - 1 > 0) {
      const readdResult = await decksClient.addPrintings(deckId, [{ printingId, quantity: currentQty - 1, category: fromCategory }]);
      if (!readdResult.success) {
        toast({ title: "Move failed", description: readdResult.error, variant: "destructive" });
        return;
      }
    }
    const addResult = await decksClient.addPrintings(deckId, [{ printingId, quantity: 1, category: toCategory }]);
    if (!addResult.success) {
      toast({ title: "Move failed", description: addResult.error, variant: "destructive" });
      return;
    }
    await handlers.refreshDeck();
  };

  // Move a card from one category to another (remove + re-add)
  const handleMoveDeckCard = async (
    printingId: string,
    fromCategory: DeckCategory,
    toCategory: DeckCategory,
    quantity: number
  ) => {
    const removeResult = await decksClient.removePrinting(deckId, printingId, fromCategory, 999999);
    if (!removeResult.success) {
      toast({ title: "Move failed", description: removeResult.error, variant: "destructive" });
      return;
    }
    const addResult = await decksClient.addPrintings(deckId, [{ printingId, quantity, category: toCategory }]);
    if (!addResult.success) {
      toast({ title: "Move failed", description: addResult.error, variant: "destructive" });
      return;
    }
    await handlers.refreshDeck();
  };


  const [buildsExpanded, setBuildsExpanded] = useState(true);
  const [buildsLoading, setBuildsLoading] = useState(false);
  // Stronger-border attention treatment on the Starter Kits chip, shown until
  // the user opens the dropdown once (per browser). Initialized true and
  // downgraded in an effect so SSR/hydration markup stays deterministic.
  const [kitsAttention, setKitsAttention] = useState(true);
  useEffect(() => {
    if (localStorage.getItem("starter-kits-attention-seen") === "1") setKitsAttention(false);
  }, []);
  const dismissKitsAttention = useCallback(() => {
    localStorage.setItem("starter-kits-attention-seen", "1");
    setKitsAttention(false);
  }, []);
  // Bumped by the Explore button; tells MobileCardSearch to reset to the
  // kit-browse view (mobile's Cards tab), since switching to an already-active
  // tab is otherwise a visible no-op.
  const [exploreSignal, setExploreSignal] = useState(0);
  const [heroCurators, setHeroCurators] = useState<Array<{ displayUsername: string; avatarUrl: string | null; metafyProductUrl: string | null; metafyLinkLabel: string | null }>>([]);
  const [previewBuild, setPreviewBuild] = useState<{
    name: string;
    description?: string | null;
    cards: Array<{ printingId: string; displayName?: string; color?: string; setCode?: string; imageUrl?: string; comment?: string | null }>;
    curatorUser: { username: string; displayUsername: string; avatarUrl: string | null; metafyProductUrl: string | null } | null;
  } | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [addingCard, setAddingCard] = useState<string | null>(null);
  const [addingBenchCard, setAddingBenchCard] = useState<string | null>(null);
  const [addingInventoryCard, setAddingInventoryCard] = useState<string | null>(null);
  const [cardSplits, setCardSplits] = useState<Map<string, PackageSplit>>(new Map());

  // Deduplicated cards from the active preview build
  const seenCards = React.useMemo(() => {
    if (!previewBuild) return [] as Array<{ card: { printingId: string; displayName?: string; color?: string; setCode?: string; imageUrl?: string; comment?: string | null }; qty: number }>;
    const seen = new Map<string, { card: typeof previewBuild.cards[0]; qty: number }>();
    for (const card of previewBuild.cards) {
      const existing = seen.get(card.printingId);
      if (existing) existing.qty++;
      else seen.set(card.printingId, { card, qty: 1 });
    }
    return Array.from(seen.values());
  }, [previewBuild]);

  // Reset all splits to "all deck" when a new build is opened
  useEffect(() => {
    const splits = new Map<string, PackageSplit>();
    for (const { card, qty } of seenCards) splits.set(card.printingId, defaultSplit(qty));
    setCardSplits(splits);
  }, [previewBuild]);

  // Set-all keeps each card's chosen total (a "Qty" override survives a re-zone).
  const remapSplits = (fn: (s: PackageSplit) => PackageSplit) =>
    setCardSplits(prev => new Map(seenCards.map(({ card, qty }) => [card.printingId, fn(prev.get(card.printingId) ?? defaultSplit(qty))])));
  const markAllForDeck = () => remapSplits(allToDeck);
  const markAllForInventory = () => remapSplits(allToInventory);
  const markAllForBench = () => remapSplits(allToBench);

  useEffect(() => {
    if (!previewBuild) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewBuild(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewBuild]);

  const addCardToDeck = async (printingId: string, quantity: number, displayName?: string) => {
    if (!canEdit || quantity < 1) return;
    setAddingCard(printingId);
    try {
      const result = await decksClient.addPrintings(deckId, [{ printingId, quantity }]);
      if (result.success) {
        toast({ title: "Added", description: `${quantity}x ${displayName ?? printingId}` });
        await handlers.refreshDeck();
      } else {
        toast({ title: "Failed to add card", description: result.error, variant: "destructive" });
      }
    } finally {
      setAddingCard(null);
    }
  };

  const addCardToBench = async (printingId: string, quantity: number, displayName?: string) => {
    if (!canEdit || quantity < 1) return;
    setAddingBenchCard(printingId);
    try {
      const result = await decksClient.addPrintings(deckId, [{ printingId, quantity, category: 'benched' }]);
      if (result.success) {
        toast({ title: "Added to bench", description: `${quantity}x ${displayName ?? printingId}` });
        await handlers.refreshDeck();
      } else {
        toast({ title: "Failed to add to bench", description: result.error, variant: "destructive" });
      }
    } finally {
      setAddingBenchCard(null);
    }
  };

  const addCardToInventory = async (printingId: string, quantity: number, displayName?: string) => {
    if (!canEdit || quantity < 1) return;
    setAddingInventoryCard(printingId);
    try {
      const result = await decksClient.addPrintings(deckId, [{ printingId, quantity, category: 'inventory' as DeckCategory }]);
      if (result.success) {
        toast({ title: "Added to inventory", description: `${quantity}x ${displayName ?? printingId}` });
        await handlers.refreshDeck();
      } else {
        toast({ title: "Failed to add to inventory", description: result.error, variant: "destructive" });
      }
    } finally {
      setAddingInventoryCard(null);
    }
  };

  const addAllToDeck = async () => {
    if (!canEdit || !previewBuild) return;
    setAddingAll(true);
    try {
      const items = seenCards.flatMap(({ card, qty }) =>
        splitToItems(card.printingId, cardSplits.get(card.printingId) ?? defaultSplit(qty))
          .map(i => (i.category ? { ...i, category: i.category as DeckCategory } : { printingId: i.printingId, quantity: i.quantity })),
      );
      if (items.length === 0) return;
      const result = await decksClient.addPrintings(deckId, items);
      if (result.success) {
        const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);
        toast({ title: "Added all", description: `${totalCards} card${totalCards !== 1 ? "s" : ""} added` });
        await handlers.refreshDeck();
      } else {
        toast({ title: "Failed to add cards", description: result.error, variant: "destructive" });
      }
    } finally {
      setAddingAll(false);
    }
  };

  // Swap a printing in the saved deck (called after user selects new printing in dialog)
  const handleSwapDeckPrinting = async (newPrinting: any) => {
    if (!deckSwapTarget) return;
    const result = await decksClient.swapPrinting(
      deckId,
      deckSwapTarget.printingId,
      newPrinting.printing_id,
      deckSwapTarget.category
    );
    if (result.success) {
      toast({ title: "Printing swapped" });
      await handlers.refreshDeck();
    } else {
      toast({ title: "Swap failed", description: result.error, variant: "destructive" });
    }
    setDeckSwapTarget(null);
  };

  // Mount-guarded — reading navigator.platform during render causes a #418
  // hydration mismatch (server has no navigator → 'Ctrl', Mac client → '⌘').
  const isMac = useIsMac();
  const modKey = isMac ? '⌘' : 'Ctrl';

  // The Deck Tools (⌘K HUD) trigger — one look, two homes: the floating pill and the right rail.

  return (
    // overflow-x-clip (not -hidden): hidden creates a scroll container, which breaks the right rail's position:sticky
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-clip">
      {/* Dormant HUD trigger. Floats bottom-RIGHT on sm+ (bottom-center on phones, above the
          mobile tab pill). On the xl deck tab the floating copy is hidden and the same trigger
          renders as the right rail's first row instead — a fixed pill anywhere over the tile
          grid or the rail hides content at some scroll position. The open HUD stays centered. */}
      {!chordMode && (
        <div className={cn(
          "fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50",
          activeTab === 'deck' && "xl:hidden",
        )}>
          {renderToolsTrigger()}
        </div>
      )}

      {/* Chord mode HUD — shown when Cmd/Ctrl+K is pressed */}
      {commandHud}

      {canEdit && activeTab === "search" && (
        <DeckEditorSidebar
          deck={optimisticDeck ?? state.deck}
          deckLoading={state.deckLoading}
          stagedCards={stagedCards}
          deckCounts={(() => {
            const d = optimisticDeck ?? state.deck;
            if (!d) return state.deckCounts;
            return {
              hero: d.hero?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
              equipment: d.equipment?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
              maindeck: d.maindeck?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
              inventory: d.inventory?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
              benched: d.benched?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
            };
          })()}
          isSaving={state.isSaving}
          ownershipMap={state.ownershipMap}
          deckId={deckId}
          onUpdateQuantity={handlers.updateCardQuantity}
          onUnstage={handlers.toggleStagedStatus}
          onClear={handlers.clearStaged}
          onSave={handlers.handleSaveToDeck}
          onPrintingView={id => setActiveDialogInstanceId(id)}
          onSwapDeckCard={target => setDeckSwapTarget(target)}
          onRemoveDeckCard={handleRemoveDeckCard}
          onRemoveGroupFromDeck={handleRemoveGroupFromDeck}
          onUpdateDeckCardQty={handleUpdateDeckCardQty}
          onMovePrinting={handleMoveSinglePrinting}
          onRefreshDeck={handlers.refreshDeck}
        />
      )}

      <div className={canEdit && activeTab === "search" ? "lg:ml-96" : ""}>
        <div className="max-w-[1800px] mx-auto pt-3 pb-20 sm:pb-0 px-4 sm:px-6 lg:px-8">
          <div className="w-full">
            <OmensReleaseNotice />
            {/* Compact header: back arrow + title + view link */}
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/decks"
                className="hidden sm:flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                title="Back to Decks"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex flex-col min-w-0">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {state.deckLoading ? "Loading..." : state.deck ? state.deck.name : "Deck Editor"}
                </h1>
                {!isOwner && state.deck?.ownerUsername && (
                  <span className="text-xs text-gray-300 dark:text-gray-300 truncate">
                    by {state.deck.ownerUsername}
                  </span>
                )}
              </div>
              {state.deck?.format && (
                <span className="hidden sm:inline-flex text-sm px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 shrink-0 ml-1">
                  {state.deck.format}
                </span>
              )}
              {state.deck && (
                <button
                  type="button"
                  aria-label="Deck actions"
                  onClick={() => setMobileActionsOpen(true)}
                  className="sm:hidden ml-auto shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0">
                {!canEdit && (
                  <span className="text-sm text-gray-600 dark:text-gray-300">Read only</span>
                )}
                <DarkModeToggle />
                {state.deck && (
                  <DeckToolbarMoreMenu
                    isOwner={isOwner}
                    onCopyList={handleCopyList}
                    onExport={handleExportList}
                    onExportImage={() => setExportImageOpen(true)}
                    onAnalyze={() => router.push(`/decks/${deckId}/analyze`)}
                    onPresent={() => router.push(`/decks/${deckId}/present`)}
                    onStickers={() => router.push(`/decks/${deckId}/stickers`)}
                    onSettings={() => setSettingsOpen(true)}
                    onUpdateOwnedPrintings={canEdit ? handleUpgradePrintings : undefined}
                    onConvertLanguage={canEdit ? handleConvertLanguage : undefined}
                    onStreamOverlay={canEdit ? () => setStreamOverlayOpen(true) : undefined}
                  />
                )}
                {!canEdit && state.deck && (
                  <button
                    onClick={async () => {
                      if (!user) {
                        router.push(`/auth/signin?callbackUrl=/decks/${deckId}`);
                        return;
                      }
                      const result = await decksClient.copyDeck(deckId, `Copy of ${state.deck!.name}`);
                      if (result.success) {
                        toast({ title: "Deck copied", description: `Copied to your decks.` });
                        router.push(`/decks/${result.data.publicId}`);
                      } else {
                        toast({ title: "Error", description: result.error || "Failed to copy deck.", variant: "destructive" });
                      }
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy to My Decks
                  </button>
                )}
              </div>
            </div>

            {/* Tab bar — desktop only */}
            <div className="hidden sm:flex border-b border-gray-300 dark:border-gray-700 mb-4">
              {canEdit && (
                <button
                  onClick={() => setActiveTab("search")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "search"
                      ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <Search className="h-4 w-4" />
                  Add Cards
                </button>
              )}
              <button
                onClick={() => setActiveTab("deck")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "deck"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                <List className="h-4 w-4" />
                Deck
                {(state.deckCounts.equipment + state.deckCounts.maindeck + state.deckCounts.inventory) > 0 && (() => {
                  // Format-aware max: CC and Living Legend allow up to 80
                  // (60 maindeck + sideboard/inventory). Silver Age / Blitz /
                  // Commoner top out around 55 (40-card maindeck + inventory).
                  const youngFormats = new Set(['Silver Age', 'Blitz', 'Commoner']);
                  const max = youngFormats.has(state.deck.format) ? 55 : 80;
                  return (
                    <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                      {state.deckCounts.equipment + state.deckCounts.maindeck + state.deckCounts.inventory}/{max}
                    </span>
                  );
                })()}
              </button>
              <Link
                href={`/decks/${deckId}/matchups`}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-t"
              >
                <Swords className="h-4 w-4" />
                Matchups
              </Link>
              {canEdit && (
                <button
                  onClick={() => setActiveTab("results")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "results"
                      ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <Trophy className="h-4 w-4" />
                  Results
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setActiveTab("notes")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "notes"
                      ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Notes
                </button>
              )}
              <Link
                href={`/decks/${deckId}/present`}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-t"
                title="Open the presenter / shareable view"
              >
                <Tv className="h-4 w-4" />
                Present
              </Link>
            </div>

            {/* Content + right rail — flex layout keeps the rail aligned with the top of the tab content. */}
            <div className="flex gap-4 xl:gap-6 items-start">
              <div className="flex-1 min-w-0">

            {/* Deck legality strip — appears when the deck contains cards banned in its format */}
            {state.deck && bannedCardIds.size > 0 && (() => {
              const allCards = [
                ...(state.deck.hero ?? []),
                ...(state.deck.equipment ?? []),
                ...(state.deck.maindeck ?? []),
                ...(state.deck.inventory ?? []),
              ];
              const seen = new Set<string>();
              const hits: Array<{ name: string; pitch?: number }> = [];
              for (const c of allCards) {
                const cuid = c.printingDetails?.card_unique_id;
                if (!cuid || !bannedCardIds.has(cuid)) continue;
                const key = `${cuid}-${c.printingDetails?.pitch ?? ''}`;
                if (seen.has(key)) continue;
                seen.add(key);
                hits.push({
                  name: c.printingDetails?.display_name || c.printingDetails?.name || 'Unknown card',
                  pitch: c.printingDetails?.pitch,
                });
              }
              if (hits.length === 0) return null;
              const switchToOpen = async () => {
                if (!state.deck) return;
                setSwitchingFormat(true);
                try {
                  const res = await decksClient.updateDeck(deckId, { format: 'Open' } as any);
                  if (res.success) {
                    invalidateBannedCardsCache();
                    setBannedCardIds(new Set());
                    await handlers.refreshDeck();
                    toast({ title: 'Format switched to Open' });
                  } else {
                    toast({ title: 'Failed to switch format', description: res.error, variant: 'destructive' });
                  }
                } finally {
                  setSwitchingFormat(false);
                }
              };
              const pitchLabel = (p?: number) => p === 1 ? 'red' : p === 2 ? 'yellow' : p === 3 ? 'blue' : '';
              return (
                <div className="mb-3 rounded-lg border border-amber-400/70 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Deck contains {hits.length} card{hits.length === 1 ? '' : 's'} banned in {state.deck.format}
                      </div>
                      <div className="text-xs mt-1 text-amber-800 dark:text-amber-200">
                        {hits.map(h => h.name + (h.pitch ? ` (${pitchLabel(h.pitch)})` : '')).join(' · ')}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={switchToOpen}
                        disabled={switchingFormat}
                        className="text-xs px-2 py-1 rounded border border-amber-400 bg-white dark:bg-amber-900 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-800 disabled:opacity-50 shrink-0"
                      >
                        {switchingFormat ? 'Switching…' : 'Switch to Open'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Starter Kits — a compact dropdown of curated builds + optional curator guide links.
                Designed to stay one-line tall regardless of how many kits are available. */}
            {(() => {
              const curatorsWithMetafy = heroCurators.filter(c => c.metafyProductUrl);
              // Promote the chip to a primary CTA when the deck is essentially empty —
              // makes the "start here" path obvious for first-time builders.
              const isEmptyDeck = (buildProgress?.totalCards.current ?? 0) === 0;
              const hasKits = buildsLoading || curatedBuilds.length > 0 || curatorsWithMetafy.length > 0;
              // Stats ride along on this row: mobile gets the Stats popover
              // chip, desktop gets the pitch/avg-cost chips inline — so the
              // deck tab opens with ONE header chip row, not three.
              const showStats = activeTab === "deck" && railStats != null;
              if (!canEdit && !showStats) return null;
              return (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {canEdit && hasKits && <DropdownMenu onOpenChange={(open) => { if (open) dismissKitsAttention() }}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={buildsLoading}
                        className={cn(
                          "inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60",
                          isEmptyDeck
                            ? "border-blue-400/70 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25 font-semibold"
                            : "bg-white dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-400/50 dark:border-blue-500/40",
                          kitsAttention && "border-blue-400 dark:border-blue-400"
                        )}
                      >
                        <Sparkles className={cn("h-3.5 w-3.5", isEmptyDeck ? "text-blue-300" : "text-blue-500 dark:text-blue-400")} aria-hidden="true" />
                        {/* "Kits" on phones — the row has to hold Explore + Stats too. */}
                        <span className={isEmptyDeck ? "font-semibold" : "font-medium"}>
                          {isEmptyDeck ? "Start with a Starter Kit" : (
                            <>
                              <span className="sm:hidden">Kits</span>
                              <span className="hidden sm:inline">Starter Kits</span>
                            </>
                          )}
                        </span>
                        {!buildsLoading && curatedBuilds.length > 0 && (
                          <span className={cn("text-xs", isEmptyDeck ? "text-blue-200" : "text-gray-500 dark:text-gray-400")}>{curatedBuilds.length}</span>
                        )}
                        {buildsLoading
                          ? <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" aria-hidden="true" />
                          : <ChevronDown className={cn("h-3.5 w-3.5", isEmptyDeck ? "text-blue-300" : "text-gray-400")} aria-hidden="true" />
                        }
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[260px]">
                      {curatedBuilds.map(build => (
                        <DropdownMenuItem
                          key={build.id}
                          onClick={() => setPreviewBuild({ name: build.name, description: build.description, cards: build.cards, curatorUser: build.curatorUser })}
                          className="gap-2 text-sm"
                        >
                          {build.curatorUser?.avatarUrl
                            ? <img src={build.curatorUser.avatarUrl} className="h-5 w-5 rounded-full shrink-0" alt="" />
                            : <Sparkles className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
                          }
                          <span className="truncate">{build.name}</span>
                        </DropdownMenuItem>
                      ))}
                      {curatedBuilds.length > 0 && curatorsWithMetafy.length > 0 && <DropdownMenuSeparator />}
                      {curatorsWithMetafy.map(c => (
                        <DropdownMenuItem key={c.metafyProductUrl} asChild>
                          <a
                            href={c.metafyProductUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gap-2 text-sm"
                          >
                            {c.avatarUrl
                              ? <img src={c.avatarUrl} className="h-5 w-5 rounded-full shrink-0" alt="" />
                              : <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
                            }
                            <span className="truncate">{c.metafyLinkLabel || `${c.displayUsername}'s Metafy guide`}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-60" aria-hidden="true" />
                          </a>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>}

                  {/* Explore button — desktop opens QuickAddCardDialog (same as
                      ⌘K → 9 chord); mobile switches to the Cards tab and resets
                      it to the kit-browse view (exploreSignal → MobileCardSearch).
                      Sits next to "Start with a Starter Kit" so brewers see both paths. */}
                  {canEdit && <button
                    type="button"
                    onClick={() => { openQuickAdd({ category: 'maindeck' }); setExploreSignal(s => s + 1) }}
                    aria-label={`Explore the card pool (${modKey} K, then 9)`}
                    className={cn(
                      "inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                      isEmptyDeck
                        ? "border-blue-400/70 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25 font-semibold"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <Search className={cn("h-3.5 w-3.5", isEmptyDeck ? "text-blue-300" : "text-gray-500 dark:text-gray-400")} aria-hidden="true" />
                    <span className={isEmptyDeck ? "font-semibold" : "font-medium"}>Explore</span>
                    <kbd className="hidden sm:inline-block rounded border border-current/30 bg-black/10 dark:bg-white/10 px-1.5 py-0.5 font-sans text-[10px] font-bold opacity-80">
                      {modKey}K → 9
                    </kbd>
                  </button>}

                  {/* Pimp My Deck — blingier printings of this deck's cards
                      that the VIEWER doesn't own yet. Signed-in only (the page
                      compares against the caller's collection). Mobile-only
                      chip: md+ gets the bigger banner button in the display
                      toolbar (DeckEditorListView). */}
                  {user && (
                    <Link
                      href={`/decks/${deckId}/upgrade`}
                      aria-label="Pimp My Deck — upgraded printings you don't own yet"
                      title="Pimp My Deck — upgraded printings you don't own yet"
                      className="md:hidden inline-flex items-center rounded-md border border-amber-400/70 bg-amber-100/60 dark:bg-amber-900/30 px-1.5 py-0.5 transition-colors hover:bg-amber-200/70 dark:hover:bg-amber-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <img
                        src="/images/pimp-my-deck.png"
                        alt=""
                        aria-hidden="true"
                        className="h-6 w-auto rounded-sm"
                      />
                    </Link>
                  )}

                  {showStats && railStats && (
                    <DeckStatsPopover
                      className="sm:hidden"
                      noPitch={railStats.pitchCounts.none ?? 0}
                      averageCost={railStats.averageCost}
                      sectionCounts={railStats.sectionCounts}
                    />
                  )}
                  {/* Desktop: full pitch/cost chips inline. Zone counts are NOT
                      here — every view's section headers already carry them. */}
                  {showStats && railStats && (
                    <div className="hidden sm:contents">
                      {renderPitchChips(railStats, true)}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Search tab content */}
            {canEdit && activeTab === "search" && (
              <>
                {/* Mobile: card grid with direct +/- controls */}
                {state.deck && (
                  <div className="sm:hidden -mx-4">
                    <MobileCardSearch
                      deck={state.deck}
                      deckId={deckId}
                      onDeckChange={handlers.refreshDeck}
                      kitBuilds={curatedBuilds}
                      exploreSignal={exploreSignal}
                      addZone={mobileAddZone}
                      onAddZoneChange={setMobileAddZone}
                    />
                  </div>
                )}

                {/* Desktop: existing bulk import form */}
                <div className="hidden sm:block">
                {searchFormOpen ? (
                  <BulkImportForm
                    bulkInput={state.bulkInput}
                    onInputChange={handlers.setBulkInput}
                    onSearch={handleSearch}
                    loading={state.loading}
                  />
                ) : (
                  <div
                    onClick={() => setSearchFormOpen(true)}
                    className="flex items-center gap-3 mb-6 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Search className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="flex-1 text-sm text-gray-600 dark:text-gray-300">
                      {state.bulkResults.length} result{state.bulkResults.length !== 1 ? "s" : ""} — click to search again
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlers.clearBulkResults(); setSearchFormOpen(true); }}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  </div>
                )}

                {state.error && (
                  <Alert variant="destructive" className="mb-8">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Search Failed</AlertTitle>
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}

                {state.excludedBulkCards.length > 0 && !state.loading && (() => {
                  const titleCase = (s: string) =>
                    s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  return (
                  <Alert className="mb-4 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="flex items-center justify-between gap-2">
                      <span>Some cards weren't imported</span>
                      <button
                        type="button"
                        onClick={handlers.dismissExcludedBulkCards}
                        className="text-xs font-normal text-amber-800 dark:text-amber-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
                        aria-label="Dismiss excluded cards notice"
                      >
                        Dismiss
                      </button>
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc ml-5 mt-1 space-y-0.5 text-sm">
                        {state.excludedBulkCards.map((c, i) => (
                          <li key={`${c.name}-${i}`}>
                            <span className="font-semibold">{c.quantity}x {titleCase(c.name)}</span>
                            {' — '}
                            {c.reason === 'banned'
                              ? <>banned in <span className="font-medium">{state.deck?.format ?? 'this format'}</span></>
                              : c.reason === 'format'
                                ? <>not legal in <span className="font-medium">{state.deck?.format ?? 'this format'}</span></>
                                : <>no matching card found</>}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                  );
                })()}

                {state.bulkResults.length > 0 && !state.loading && (
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => handlers.stageAll()}
                      className="text-sm px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                    >
                      Stage All
                    </button>
                    <button
                      onClick={() => { handlers.clearBulkResults(); setSearchFormOpen(true); }}
                      className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      Clear Results
                    </button>
                  </div>
                )}

                <BulkResultsGrid
                  cards={state.bulkResults}
                  loading={state.loading}
                  hideStaged={false}
                  onUpdatePrinting={handlers.updateCardPrinting}
                  onQuantityChange={handlers.updateCardQuantity}
                  onToggleTrade={() => {}}
                  onDuplicate={handlers.duplicateCard}
                  onRemove={handlers.removeCard}
                  onToggleStaged={handlers.toggleStagedStatus}
                  onPrintingView={id => setActiveDialogInstanceId(id)}
                />
                </div>
              </>
            )}

            {/* Deck tab content */}
            {activeTab === "deck" && (
              <>
                {state.deckLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : state.deck ? (
                  <>
                  {/* Empty-deck hero — desktop only, replaces the build progress strip when the deck has no cards.
                      Surfaces starter kits as the obvious first action. */}
                  {buildProgress && !buildProgressDismissed && buildProgress.totalCards.current === 0 && (
                    <div className="hidden lg:block mb-3">
                      <EmptyDeckHero
                        deckName={state.deck.name}
                        kits={curatedBuilds}
                        loading={buildsLoading}
                        onKitClick={(kit) => setPreviewBuild({
                          name: kit.name,
                          description: kit.description,
                          cards: kit.cards,
                          curatorUser: kit.curatorUser,
                        })}
                        onSearchClick={() => openQuickAdd({ category: 'maindeck' })}
                      />
                    </div>
                  )}
                  {/* Mobile second chip row: Total + R/Y/B (No Pitch, Avg Cost and
                      zone counts live in the Stats popover on the row above).
                      Desktop renders these chips inline on the Kits/Explore row
                      instead — zone counts intentionally nowhere: every view's
                      section headers already carry them. */}
                  {railStats && (
                    <div className="sm:hidden mb-3 flex flex-wrap items-center gap-2">
                      {renderPitchChips(railStats, false)}
                    </div>
                  )}
                  <DeckEditorListView
                    deck={state.deck}
                    ownershipMap={state.ownershipMap}
                    cardOwnershipMap={state.cardOwnershipMap}
                    onSwap={target => setDeckSwapTarget(target)}
                    onRemove={handleRemoveDeckCard}
                    onMove={handleMoveDeckCard}
                    onMoveSingle={handleMoveSinglePrinting}
                    onRemoveTile={(printingId, category, currentQty) =>
                      handleUpdateDeckCardQty(printingId, Math.max(0, currentQty - 1), category)
                    }
                    onAddOneTile={(printingId, category, currentQty) =>
                      handleUpdateDeckCardQty(printingId, currentQty + 1, category)
                    }
                    onSwapCopies={async (oldPrintingId, newPrintingId, category, copies) => {
                      const result = await decksClient.swapPrinting(deckId, oldPrintingId, newPrintingId, category, copies);
                      if (!result.success) {
                        toast({ title: "Could not change printing", description: result.error, variant: "destructive" });
                        await handlers.refreshDeck();
                        return false;
                      }
                      await handlers.refreshDeck();
                      toast({ title: "Printing updated", description: `${copies} ${copies === 1 ? 'copy' : 'copies'} moved to the selected printing.` });
                      return true;
                    }}
                    onAddCard={(category, pitch) => openQuickAdd({ category, pitch })}
                    canEdit={canEdit}
                    defaultViewMode={authLoading || !viewportResolved ? undefined : resolveDefaultDeckViewMode(canEdit, isMobile)}
                    binders={binders}
                    selectedBinderId={selectedBinderId}
                    onBinderChange={handleBinderChange}
                    onAddToBinder={handleAddToBinder}
                    onAddToWants={handleAddToWants}
                    wantsMap={state.wantsMap}
                    onUpgradePrintings={handleUpgradePrintings}
                    onCardHover={setHoveredCard}
                  />
                  </>
                ) : null}
              </>
            )}

            {/* Results tab content */}
            {canEdit && activeTab === "results" && (
              <DeckResultsTab deckId={deckId} deck={state.deck ?? undefined} />
            )}

            {/* Notes tab content (owner/co-owner only) */}
            {canEdit && activeTab === "notes" && (
              <DeckNotesTab deckId={deckId} deck={state.deck ?? undefined} />
            )}

              </div>
              {activeTab === "deck" && state.deck && railStats && (() => {
                const cardOwnership = hoveredCard?.printingId ? state.ownershipMap.get(hoveredCard.printingId) : null;
                const hoveredWithOwnership = hoveredCard ? {
                  ...hoveredCard,
                  ...(cardOwnership ? {
                    ownedInDeck: Math.min(cardOwnership.owned, cardOwnership.needed),
                    neededInDeck: cardOwnership.needed,
                  } : {}),
                } : hoveredCard;
                return (
                  <DeckRightRail
                    ownedCount={railStats.ownedCount}
                    totalCount={railStats.totalCount}
                    hoveredCard={hoveredWithOwnership}
                    toolsTrigger={chordMode ? null : renderToolsTrigger(true)}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      </div>


      {optionsDialogs}

      {state.deck && (
        <MobileDeckActionsSheet
          open={mobileActionsOpen}
          onOpenChange={setMobileActionsOpen}
          isOwner={isOwner}
          onCopyList={handleCopyList}
          onExport={handleExportList}
          onExportImage={() => setExportImageOpen(true)}
          onAnalyze={() => router.push(`/decks/${deckId}/analyze`)}
          onPresent={() => router.push(`/decks/${deckId}/present`)}
          onStickers={() => router.push(`/decks/${deckId}/stickers`)}
          onSettings={() => setSettingsOpen(true)}
          onUpdateOwnedPrintings={canEdit ? handleUpgradePrintings : undefined}
          onConvertLanguage={canEdit ? handleConvertLanguage : undefined}
        />
      )}


      {/* Dialog: swap printing for staged (search tab) cards */}
      <ViewPrintingsDialog
        open={!!activeDialogInstanceId}
        onOpenChange={isOpen => !isOpen && setActiveDialogInstanceId(null)}
        cardName={activeInstance?.selectedPrinting?.display_name || ""}
        cardUniqueId={activeInstance?.card_unique_id || ""}
        currentPrintingId={activeInstance?.selectedPrinting?.printing_id}
        onSelectPrinting={printing => {
          if (activeInstance) {
            handlers.updateCardPrinting(activeInstance.instanceId, printing);
          }
          setActiveDialogInstanceId(null);
        }}
      />

      {/* Dialog: swap printing for existing deck cards */}
      <ViewPrintingsDialog
        open={!!deckSwapTarget}
        onOpenChange={isOpen => !isOpen && setDeckSwapTarget(null)}
        cardName={deckSwapTarget?.cardName || ""}
        cardUniqueId={deckSwapTarget?.cardUniqueId || ""}
        currentPrintingId={deckSwapTarget?.printingId}
        onSelectPrinting={handleSwapDeckPrinting}
      />

      {/* Mobile bottom tab pill — floating, matching the site-wide MobileTabBar's
          geometry (which hides itself on this route). Deck-context tabs (incl.
          "Deck" to return from the Cards view) are what the user needs here.
          Active tab = filled bg (shape cue, not color-only).
          Hidden while the export-image dialog is open: both are z-50 and the
          pill is later in the DOM, so it would paint over the dialog's buttons. */}
      {!exportImageOpen && (
      <div className="fixed z-50 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] inset-x-3 flex justify-center sm:hidden">
        <nav
          aria-label="Deck sections"
          className="flex w-full max-w-md items-stretch gap-1 rounded-full border border-border bg-card/90 supports-[backdrop-filter]:bg-card/75 backdrop-blur-md shadow-lg p-1.5"
        >
          {canEdit && (
            <button
              onClick={() => setActiveTab("search")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 min-h-12 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
                activeTab === "search"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="h-5 w-5" />
              Cards
            </button>
          )}
          <button
            onClick={() => setActiveTab("deck")}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 min-h-12 text-xs font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
              activeTab === "deck"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <List className="h-5 w-5" />
              {(state.deckCounts.equipment + state.deckCounts.maindeck + state.deckCounts.inventory) > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                  {state.deckCounts.equipment + state.deckCounts.maindeck + state.deckCounts.inventory}
                </span>
              )}
            </div>
            Deck
          </button>
          <Link
            href={`/decks/${deckId}/matchups`}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 min-h-12 text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
          >
            <Swords className="h-5 w-5" />
            Matchups
          </Link>
          {canEdit && (
            <button
              onClick={() => setActiveTab("results")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 min-h-12 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
                activeTab === "results"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Trophy className="h-5 w-5" />
              Results
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 min-h-12 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
                activeTab === "notes"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <FileText className="h-5 w-5" />
              Notes
            </button>
          )}
        </nav>
      </div>
      )}

      {/* Dialog: quick-add a single card to a specific zone (desktop only;
          mobile users get routed to the inline Cards tab via openQuickAdd) */}
      <QuickAddCardDialog
        open={!isMobile && !!quickAddTarget}
        onOpenChange={isOpen => !isOpen && setQuickAddTarget(null)}
        onAdd={handleQuickAddCard}
        targetCategory={quickAddTarget?.category ?? "maindeck"}
        pitchFilter={quickAddTarget?.pitch}
        deckFormat={state.deck?.format}
        currentDeck={state.deck ?? undefined}
      />


      {/* Package preview modal */}
      {previewBuild && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 overflow-y-auto py-8" onClick={() => setPreviewBuild(null)}>
          <div className="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-700">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold text-lg">{previewBuild.name}</span>
                  <span className="text-gray-400 text-sm">{previewBuild.cards.length} card{previewBuild.cards.length !== 1 ? "s" : ""}</span>
                </div>
                {previewBuild.description && (
                  <p className="text-gray-400 text-sm max-w-2xl">{previewBuild.description}</p>
                )}
                {previewBuild.curatorUser && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {previewBuild.curatorUser.avatarUrl && (
                      <img src={previewBuild.curatorUser.avatarUrl} className="h-5 w-5 rounded-full" alt="" />
                    )}
                    <span className="text-gray-400 text-xs">by {previewBuild.curatorUser.displayUsername}</span>
                    {previewBuild.curatorUser.metafyProductUrl && (
                      <a
                        href={previewBuild.curatorUser.metafyProductUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <img src="/metafy-white.svg" alt="Metafy" className="h-3.5 w-auto shrink-0" />
                        <span>Metafy guide</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setPreviewBuild(null)} className="text-gray-400 hover:text-white transition-colors mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            {canEdit && (
              <div className="px-6 py-3 border-b border-gray-700 flex items-center gap-2">
                <div className="flex-1" />
                <button
                  onClick={markAllForDeck}
                  className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                  Set all to Deck
                </button>
                <button
                  onClick={markAllForInventory}
                  className="text-xs px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white font-medium transition-colors"
                >
                  Set all to Inventory
                </button>
                <button
                  onClick={markAllForBench}
                  className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium transition-colors"
                >
                  Set all to Bench
                </button>
                <button
                  onClick={addAllToDeck}
                  disabled={addingAll}
                  className="text-sm px-4 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-medium transition-colors flex items-center gap-2"
                >
                  {addingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Import All
                </button>
              </div>
            )}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(() => {
                const deckCopies = new Map<string, number>();
                for (const category of ['hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens'] as const) {
                  for (const c of state.deck?.[category] ?? []) {
                    deckCopies.set(c.printingId, (deckCopies.get(c.printingId) ?? 0) + (c.quantity ?? 1));
                  }
                }
                const shownComments = new Set<string>();
                return seenCards.map(({ card, qty }) => {
                  const cardName = card.displayName ?? '';
                  const showComment = !!card.comment && cardName && !shownComments.has(cardName);
                  if (showComment) shownComments.add(cardName);
                  return (
                    <PackageCardItem
                      key={card.printingId}
                      card={card}
                      split={cardSplits.get(card.printingId) ?? defaultSplit(qty)}
                      onSplitChange={next => setCardSplits(prev => new Map(prev).set(card.printingId, next))}
                      adding={addingCard === card.printingId}
                      addingInventory={addingInventoryCard === card.printingId}
                      addingBench={addingBenchCard === card.printingId}
                      isOwner={canEdit}
                      inDeck={deckCopies.get(card.printingId) ?? 0}
                      comment={showComment ? card.comment ?? undefined : undefined}
                      onAdd={q => addCardToDeck(card.printingId, q, card.displayName)}
                      onAddToInventory={q => addCardToInventory(card.printingId, q, card.displayName)}
                      onAddToBench={q => addCardToBench(card.printingId, q, card.displayName)}
                    />
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
