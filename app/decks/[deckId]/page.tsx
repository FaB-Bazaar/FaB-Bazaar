"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, Search, List, X, Swords, LayoutGrid, Eye, Sparkles, Trophy, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, ExternalLink, Settings, Copy, Download, Check, Tv } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeckEditor } from "@/hooks/deck/useDeckEditor";
import type { SwapTarget } from "@/hooks/deck/useDeckEditor";
import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";
import { KEYWORDS } from "@/lib/fab-constants/keywords";
import { decksClient, bindersClient, wantsClient } from "@/lib/client";
import { deckFormatToBannedFormat, fetchBannedCardsForFormat, invalidateBannedCardsCache } from "@/lib/client/banned-cards-client";
import { upgradeToOwnedPrintings } from "@/lib/client/decks-client";
import DeckEditorSidebar from "@/components/deck/editor/DeckEditorSidebar";
import DeckEditorListView from "@/components/deck/editor/DeckEditorListView";
import DeckToolbarMoreMenu from "@/components/deck/editor/DeckToolbarMoreMenu";
import DeckRightRail from "@/components/deck/editor/DeckRightRail";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DeckSettings from "@/components/deck/DeckSettings";
import DeckResultsTab from "@/components/deck/DeckResultsTab";
import QuickAddCardDialog, { TYPE_CHIPS, GENERIC_CHIP } from "@/components/deck/editor/QuickAddCardDialog";
import { preloadCardPool } from "@/lib/client/card-pool-cache";
import { getHeroInfo } from "@/lib/fab-constants";
import { OFFICIAL_TALENTS } from "@/lib/talent-constants";
import MobileCardSearch from "@/components/deck/editor/MobileCardSearch";
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
  defaultQty,
  deckQty,
  inventoryQty,
  onDeckQtyChange,
  onInventoryQtyChange,
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
  defaultQty: number;
  deckQty: number;
  inventoryQty: number;
  onDeckQtyChange: (qty: number) => void;
  onInventoryQtyChange: (qty: number) => void;
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
  const benchQty = defaultQty - deckQty - inventoryQty;
  const busy = adding || addingInventory || addingBench;

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
          {/* Deck row — ↓ send one to inventory, ↓↓ send one straight to bench */}
          <div className="w-full flex items-center gap-1">
            <span className="text-[10px] text-gray-400 w-8 shrink-0">Deck</span>
            <span className={cn("flex-1 text-center text-xs font-semibold tabular-nums", deckQty > 0 ? "text-blue-400" : "text-gray-600")}>{deckQty}</span>
            <button
              onClick={() => { onDeckQtyChange(deckQty - 1); onInventoryQtyChange(inventoryQty + 1); }}
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
              onClick={() => { onInventoryQtyChange(inventoryQty - 1); onDeckQtyChange(deckQty + 1); }}
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
            disabled={busy}
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

const PITCH_LABEL: Record<number, string> = { 1: "(red)", 2: "(yel)", 3: "(blu)" };

function buildDeckExportText(deck: DeckDTO): string {
  const totals = new Map<string, number>();
  const keyOrder: string[] = [];
  for (const category of ["equipment", "maindeck", "inventory"] as const) {
    const cards = (deck[category] ?? []) as DeckPrintingDTO[];
    for (const card of cards) {
      const qty = card.quantity ?? 1;
      const name = card.printingDetails?.display_name || card.printingDetails?.name || card.printingId;
      const pitch = card.printingDetails?.pitch;
      const pitchStr = pitch ? ` ${PITCH_LABEL[pitch]}` : "";
      const key = `${name}${pitchStr}`;
      if (!totals.has(key)) keyOrder.push(key);
      totals.set(key, (totals.get(key) ?? 0) + qty);
    }
  }
  return keyOrder.map(key => `${totals.get(key)} ${key}`).join("\n");
}

export default function DeckEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const deckId = params.deckId as string;

  const { state, handlers } = useDeckEditor(deckId);

  // Tab state
  const [activeTab, setActiveTab] = useState<"search" | "deck" | "results">("deck");

  // Quick-add dialog state
  const [quickAddTarget, setQuickAddTarget] = useState<{ category: DeckCategory; pitch?: 1 | 2 | 3 } | null>(null);

  // Optimistic deck state for instant qty feedback in sidebar
  const [optimisticDeck, setOptimisticDeck] = useState<DeckDTO | null>(null);

  // Binder state
  const [binders, setBinders] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<string>("");

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

  // Export/copy state
  const [copySuccess, setCopySuccess] = useState(false);

  // Deck settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Banned-card detection (populates after deck + format are known)
  const [bannedCardIds, setBannedCardIds] = useState<Set<string>>(new Set());
  const [switchingFormat, setSwitchingFormat] = useState(false);

  const handleSaveSettings = async (settings: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    visibility: 'private' | 'unlisted' | 'public';
    isPublic: boolean;
    availableOnTalishar: boolean;
    metafyGuideId: string | null;
    eventName: string | null;
    eventDate: string | null;
    placing: number | null;
  }) => {
    setSettingsSaving(true);
    try {
      const result = await decksClient.updateDeck(deckId, {
        name: settings.name,
        description: settings.description,
        format: settings.format,
        heroName: settings.hero,
        visibility: settings.visibility,
        availableOnTalishar: settings.availableOnTalishar,
        metafyGuideId: settings.metafyGuideId,
        eventName: settings.eventName,
        eventDate: settings.eventDate,
        placing: settings.placing,
      } as any);
      if (!result.success) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        throw new Error(result.error);
      }
      handlers.refreshDeck();
      toast({ title: "Settings saved" });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Tracks whether the one-time auto-search from curated builds has fired
  const autoSearchedRef = useRef(false);

  // Dialog state: for staged card printing swap
  const [activeDialogInstanceId, setActiveDialogInstanceId] = useState<string | null>(null);

  // Dialog state: for deck card printing swap
  const [deckSwapTarget, setDeckSwapTarget] = useState<SwapTarget | null>(null);

  const isOwner = !!(user && state.deck && state.deck.userId === user.id);
  const isCoOwner = !!(user && state.deck && !isOwner && (state.deck.coOwners ?? []).includes(user.id));
  const canEdit = isOwner || isCoOwner;

  const stagedCards = state.bulkResults.filter(c => c.isStaged);

  // Hovered card preview shown in the right rail.
  const [hoveredCard, setHoveredCard] = useState<{ url: string; name: string } | null>(null);

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
    return { pitchCounts: { red, yellow, blue, none }, averageCost, ownedCount: owned, totalCount: total };
  }, [state.deck, state.ownershipMap]);

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
    if (result.success) {
      await handlers.refreshDeck();
      // Keep dialog open so user can add more cards
    } else {
      toast({ title: "Add failed", description: result.error, variant: "destructive" });
    }
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


  // Preload card pool in the background after deck + hero are known
  useEffect(() => {
    if (!state.deck) return;
    const deck = state.deck;
    const TALENT_SET = new Set(OFFICIAL_TALENTS);
    const NON_CLASS = new Set(['hero','young','adult','token','equipment','weapon','action','attack','instant','defense reaction','attack reaction','demi-hero']);

    let heroClasses: string[] = [];
    let heroTalents: string[] = [];

    const h = deck.hero?.[0]?.printingDetails as Record<string, unknown> | undefined;
    if (h) {
      const directClasses = ((h.classes as string[] | undefined) || []).map(c => c.toLowerCase()).filter(Boolean);
      const directTalents = ((h.talents as string[] | undefined) || []).map(t => t.toLowerCase()).filter(Boolean);
      if (directClasses.length || directTalents.length) {
        heroClasses = directClasses; heroTalents = directTalents;
      } else {
        const heroTypes = ((h.types as string[] | undefined) || []).map(t => t.toLowerCase());
        heroClasses = heroTypes.filter(t => !TALENT_SET.has(t) && !NON_CLASS.has(t));
        heroTalents = heroTypes.filter(t => TALENT_SET.has(t));
      }
    }
    if (!heroClasses.length && deck.heroName) {
      const info = getHeroInfo(deck.heroName);
      if (info) { heroClasses = info.classes; heroTalents = info.talents; }
    }
    if (!heroClasses.length) return;

    preloadCardPool(
      { heroClasses, heroTalents, heroEssences: [], format: deck.format },
      [...TYPE_CHIPS, GENERIC_CHIP],
    );
  }, [state.deck?.heroName, state.deck?.hero, state.deck?.format]);

  // Fetch binders when user is available
  useEffect(() => {
    if (!user) return;
    bindersClient.getUserBinders().then(result => {
      if (result.success) {
        const list = result.data.binders || [];
        setBinders(list);
        const stored = localStorage.getItem("selectedBinderId");
        if (stored && list.some((b: any) => b._id === stored)) {
          setSelectedBinderId(stored);
        } else if (list.length > 0) {
          setSelectedBinderId(list[0]._id);
        }
      }
    });
  }, [user]);

  // ─── Chord keyboard shortcuts (Cmd/Ctrl+K → ...) ───────────────────────────
  const NON_CLASS_TYPES = new Set(['hero', 'young', 'adult', 'action', 'attack', 'defense', 'reaction', 'instant', 'equipment', 'weapon', 'token', 'mentor', 'demi-hero', 'evo']);
  const heroTypes: string[] = ((state.deck?.hero?.[0]?.printingDetails as any)?.types || []).map((t: string) => t.toLowerCase());
  const heroClass = heroTypes.find(t => !NON_CLASS_TYPES.has(t)) || '';

  const [chordMode, setChordMode] = useState<null | 'select' | 'attack' | 'cost' | 'defense' | 'type' | 'keyword' | 'clear' | 'arcane' | 'nameFilter'>(null);
  const [chordExiting, setChordExiting] = useState(false);
  const [keywordBuffer, setKeywordBuffer] = useState('');
  // Tile size — synced from DeckEditorListView via custom events
  const [tileSize, setTileSize] = useState({ idx: 0, label: 'Compact', total: 3 });
  // Range picker state for numeric highlight sub-modes
  const [hudRangeMin, setHudRangeMin] = useState(0);
  const [hudRangeMax, setHudRangeMax] = useState(9);
  // Track which filter values are currently active (for chip active-state rendering)
  const [activeHighlights, setActiveHighlights] = useState<Map<string, Set<number | string>>>(new Map());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const resetChord = () => { setChordMode(null); setKeywordBuffer(''); clearTimeout(timeout); };
    const startTimeout = () => { clearTimeout(timeout); timeout = setTimeout(resetChord, 2000); };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setChordMode('select');
        startTimeout();
        return;
      }

      if (e.key === 'Escape') {
        if (chordMode) { resetChord(); return; }
        // Double-Escape: if no chord active, clear all highlight filters
        window.dispatchEvent(new CustomEvent('deck-highlight-clear'));
        return;
      }
      if (!chordMode) return;
      // When a chord is active it takes priority over any focused input
      // (isTyping only blocks chord *entry*, not chord *continuation*)
      e.preventDefault();

      if (chordMode === 'select') {
        // Navigation & actions
        if (e.key === '9') { setQuickAddTarget({ category: 'maindeck' }); resetChord(); }
        else if (e.key === '8') { setQuickAddTarget({ category: 'inventory' }); resetChord(); }
        else if (e.key === '7') { setQuickAddTarget({ category: 'benched' as DeckCategory }); resetChord(); }
        else if (e.key.toLowerCase() === 's') { setChordMode('nameFilter'); setKeywordBuffer(''); startTimeout(); }
        else if (e.key.toLowerCase() === 'm') { router.push(`/decks/${deckId}/matchups`); resetChord(); }
        // Scroll
        else if (e.key === '0') { window.scrollTo({ top: 0, behavior: 'smooth' }); resetChord(); }
        else if (e.key === '1') { document.getElementById('deck-section-red')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        else if (e.key === '2') { document.getElementById('deck-section-yellow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        else if (e.key === '3') { document.getElementById('deck-section-blue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        else if (e.key === '4') { document.getElementById('deck-section-inventory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        // Filter sub-modes (only on deck tab — otherwise D switches to deck tab)
        else if (e.key.toLowerCase() === 'd' && activeTab !== 'deck') { setActiveTab('deck'); resetChord(); }
        else if (e.key.toLowerCase() === 'a') { setChordMode('attack'); startTimeout(); }
        else if (e.key.toLowerCase() === 'c') { setChordMode('cost'); startTimeout(); }
        else if (e.key.toLowerCase() === 'd') { setChordMode('defense'); startTimeout(); }
        else if (e.key.toLowerCase() === 't') { setChordMode('type'); startTimeout(); }
        else if (e.key.toLowerCase() === 'k') { setChordMode('keyword'); setKeywordBuffer(''); startTimeout(); }
        else if (e.key.toLowerCase() === 'f') { setChordMode('clear'); startTimeout(); }
        else if (e.key.toLowerCase() === 'w') { setChordMode('arcane'); startTimeout(); }
        else if (e.key.toLowerCase() === 'o') { window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter: 'owned' } })); resetChord(); }
        else if (e.key.toLowerCase() === 'u') { window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter: 'unowned' } })); resetChord(); }
        else { resetChord(); }
        return;
      }

      const scrollToRed = () => document.getElementById('deck-section-red')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      const EQUIPMENT_KEYWORDS = new Set(['battleworn', 'arcane barrier', 'blade break', 'cloaked', 'modular', 'spellvoid', 'quell', 'temper', 'unity', 'guardwell']);
      const scrollForKeyword = (kw: string) => EQUIPMENT_KEYWORDS.has(kw) ? scrollToTop() : scrollToRed();

      // Helper: dispatch a range of highlight filter values (e.g. power 4-6)
      const dispatchRangeFilters = (stat: string, lo: number, hi: number) => {
        const [start, end] = [Math.min(lo, hi), Math.max(lo, hi)];
        for (let v = start; v <= end; v++) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat, value: v, additive: true } }));
        }
        scrollToRed();
        resetChord();
      };

      if (chordMode === 'attack') {
        // Range syntax: press "-" first to start a range (e.g. "-4-6" = power 4,5,6)
        if (keywordBuffer.startsWith('-')) {
          const buf = keywordBuffer + e.key;
          const rangeMatch = buf.match(/^-(\d)-(\d)$/);
          if (rangeMatch) { dispatchRangeFilters('power', parseInt(rangeMatch[1]), parseInt(rangeMatch[2])); return; }
          if (e.key === 'Escape' || e.key === 'Enter') { resetChord(); return; }
          setKeywordBuffer(buf); startTimeout(); return;
        }
        if (e.key === '-') { setKeywordBuffer('-'); startTimeout(); return; }
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'power', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'cost') {
        if (keywordBuffer.startsWith('-')) {
          const buf = keywordBuffer + e.key;
          const rangeMatch = buf.match(/^-(\d)-(\d)$/);
          if (rangeMatch) { dispatchRangeFilters('cost', parseInt(rangeMatch[1]), parseInt(rangeMatch[2])); return; }
          if (e.key === 'Escape' || e.key === 'Enter') { resetChord(); return; }
          setKeywordBuffer(buf); startTimeout(); return;
        }
        if (e.key === '-') { setKeywordBuffer('-'); startTimeout(); return; }
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'cost', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'defense') {
        if (keywordBuffer.startsWith('-')) {
          const buf = keywordBuffer + e.key;
          const rangeMatch = buf.match(/^-(\d)-(\d)$/);
          if (rangeMatch) { dispatchRangeFilters('defense', parseInt(rangeMatch[1]), parseInt(rangeMatch[2])); return; }
          if (e.key === 'Escape' || e.key === 'Enter') { resetChord(); return; }
          setKeywordBuffer(buf); startTimeout(); return;
        }
        if (e.key === '-') { setKeywordBuffer('-'); startTimeout(); return; }
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'defense', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'arcane') {
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 1 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'arcane', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'type') {
        const TYPE_KEYS: Record<string, string> = {
          'a': 'attack',
          'n': 'non-attack',
          'i': 'item',
          't': 'instant',
          'd': 'defense-reaction',
          'r': 'attack-reaction',
          'e': 'equipment',
          'w': 'weapon',
          'g': 'generic',
          'h': 'hero',
          'b': 'block',
          'm': 'item',
          'z': 'ally',
          's': 'base',
          'v': 'evo',
          'u': 'aura',
          'c': heroClass || '',
        };
        const val = TYPE_KEYS[e.key.toLowerCase()];
        if (val) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'type', value: val } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'keyword') {
        if (e.key === 'Backspace') {
          setKeywordBuffer(prev => prev.slice(0, -1));
          startTimeout();
          return;
        }
        if (e.key === 'Enter') {
          const matches = (KEYWORDS as readonly string[]).filter(k => k.startsWith(keywordBuffer));
          if (matches.length >= 1) {
            window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'keyword', value: matches[0] } }));
            scrollForKeyword(matches[0]);
          }
          resetChord();
          setKeywordBuffer('');
          return;
        }
        const char = e.key.toLowerCase();
        if (/^[a-z ]$/.test(char)) {
          const next = keywordBuffer + char;
          setKeywordBuffer(next);
          const matches = (KEYWORDS as readonly string[]).filter(k => k.startsWith(next));
          if (matches.length === 1) {
            window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'keyword', value: matches[0] } }));
            scrollForKeyword(matches[0]);
            resetChord();
            setKeywordBuffer('');
          } else if (matches.length === 0) {
            setKeywordBuffer('');
            startTimeout();
          } else {
            startTimeout();
          }
        }
        return;
      }

      if (chordMode === 'nameFilter') {
        if (e.key === 'Backspace') {
          setKeywordBuffer(prev => prev.slice(0, -1));
          startTimeout();
          return;
        }
        if (e.key === 'Enter') {
          if (keywordBuffer.trim()) {
            window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'name', value: keywordBuffer.trim() } }));
          }
          resetChord();
          return;
        }
        if (e.key === 'Escape') { resetChord(); return; }
        if (e.key.length === 1) {
          setKeywordBuffer(prev => prev + e.key);
          startTimeout();
        }
        return;
      }

      if (chordMode === 'clear') {
        if (e.key === '0') window.dispatchEvent(new CustomEvent('deck-highlight-clear'));
        resetChord();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); clearTimeout(timeout); };
  }, [chordMode, activeTab, keywordBuffer]);

  // Sync tile size label from DeckEditorListView broadcasts
  useEffect(() => {
    const handler = (e: Event) => {
      const { idx, label, total } = (e as CustomEvent<{ idx: number; label: string; total: number }>).detail;
      setTileSize({ idx, label, total });
    };
    window.addEventListener('deck-tile-size-update', handler);
    return () => window.removeEventListener('deck-tile-size-update', handler);
  }, []);

  // Reset range pickers when entering a numeric sub-mode
  useEffect(() => {
    if (chordMode === 'arcane') { setHudRangeMin(1); setHudRangeMax(9); }
    else if (chordMode === 'attack' || chordMode === 'cost' || chordMode === 'defense') { setHudRangeMin(0); setHudRangeMax(9); }
  }, [chordMode]);

  // Track active highlight filters so chips can show their active state
  useEffect(() => {
    const filterHandler = (e: Event) => {
      const { stat, value, additive } = (e as CustomEvent<{ stat: string; value: number | string; additive?: boolean }>).detail;
      setActiveHighlights(prev => {
        const next = new Map(prev);
        if (!additive) {
          next.set(stat, new Set([value]));
        } else {
          const existing = next.get(stat) ?? new Set();
          next.set(stat, new Set([...existing, value]));
        }
        return next;
      });
    };
    const clearHandler = () => setActiveHighlights(new Map());
    window.addEventListener('deck-highlight-filter', filterHandler);
    window.addEventListener('deck-highlight-clear', clearHandler);
    return () => {
      window.removeEventListener('deck-highlight-filter', filterHandler);
      window.removeEventListener('deck-highlight-clear', clearHandler);
    };
  }, []);
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

  // Update quantity of a specific printing in the saved deck.
  // addPrintings STACKS (adds to existing), so we always remove first then re-add
  // with the exact desired quantity to get a true set/replace behavior.
  const handleUpdateDeckCardQty = async (printingId: string, newQty: number, category: DeckCategory) => {
    // Optimistic update — instant feedback, no waiting for API
    const base = optimisticDeck ?? state.deck;
    if (base) setOptimisticDeck(applyOptimisticQty(base, printingId, newQty, category));

    const removeResult = await decksClient.removePrinting(deckId, printingId, category, 999999);
    if (!removeResult.success) {
      setOptimisticDeck(null); // revert
      toast({ title: "Update failed", description: removeResult.error, variant: "destructive" });
      return;
    }
    if (newQty > 0) {
      const addResult = await decksClient.addPrintings(deckId, [{ printingId, quantity: newQty, category }]);
      if (!addResult.success) {
        setOptimisticDeck(null); // revert
        toast({ title: "Update failed", description: addResult.error, variant: "destructive" });
        return;
      }
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

  const [upgradeResult, setUpgradeResult] = useState<Array<{ cardName: string; color: string | null }> | null>(null);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  const handleUpgradePrintings = () => {
    setShowUpgradeConfirm(true);
  };

  const doUpgradePrintings = async () => {
    setShowUpgradeConfirm(false);
    const result = await upgradeToOwnedPrintings(deckId);
    if (result.success) {
      if (result.data.total === 0) {
        toast({ title: "All printings up to date", description: "No unowned printings found with owned alternatives." });
      } else {
        setUpgradeResult(result.data.updatedCards);
        await handlers.refreshDeck();
      }
    } else {
      toast({ title: "Update failed", description: result.error, variant: "destructive" });
    }
  };

  const [buildsExpanded, setBuildsExpanded] = useState(true);
  const [buildsLoading, setBuildsLoading] = useState(false);
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
  const [cardSplits, setCardSplits] = useState<Map<string, { deck: number; inventory: number }>>(new Map());

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
    const splits = new Map<string, { deck: number; inventory: number }>();
    for (const { card, qty } of seenCards) splits.set(card.printingId, { deck: qty, inventory: 0 });
    setCardSplits(splits);
  }, [previewBuild]);

  const markAllForDeck = () => setCardSplits(new Map(seenCards.map(({ card, qty }) => [card.printingId, { deck: qty, inventory: 0 }])));
  const markAllForInventory = () => setCardSplits(new Map(seenCards.map(({ card, qty }) => [card.printingId, { deck: 0, inventory: qty }])));
  const markAllForBench = () => setCardSplits(new Map(seenCards.map(({ card }) => [card.printingId, { deck: 0, inventory: 0 }])));

  useEffect(() => {
    if (!previewBuild && !upgradeResult) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewBuild(null);
        setUpgradeResult(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewBuild, upgradeResult]);

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
      const items = seenCards.flatMap(({ card, qty }) => {
        const split = cardSplits.get(card.printingId) ?? { deck: qty, inventory: 0 };
        const benchQty = qty - split.deck - split.inventory;
        const result = [];
        if (split.deck > 0) result.push({ printingId: card.printingId, quantity: split.deck });
        if (split.inventory > 0) result.push({ printingId: card.printingId, quantity: split.inventory, category: 'inventory' as DeckCategory });
        if (benchQty > 0) result.push({ printingId: card.printingId, quantity: benchQty, category: 'benched' as DeckCategory });
        return result;
      });
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

  const handleBinderChange = (binderId: string) => {
    setSelectedBinderId(binderId);
    localStorage.setItem("selectedBinderId", binderId);
  };

  const handleAddToBinder = async (printingId: string, cardName: string) => {
    if (!selectedBinderId) {
      toast({ title: "No binder selected", description: "Select a binder in the deck legend first.", variant: "destructive" });
      return;
    }
    const result = await bindersClient.addCardsToBinder(selectedBinderId, [{ printingId, quantity: 1, condition: "NM" }]);
    if (result.success) {
      const binderName = binders.find(b => b._id === selectedBinderId)?.name || "binder";
      toast({ title: "Added to binder", description: `${cardName} → ${binderName}` });
      await handlers.refreshDeck();
    } else {
      toast({ title: "Failed to add to binder", description: result.error, variant: "destructive" });
    }
  };

  const handleAddToWants = async (printingId: string, cardName: string) => {
    const result = await wantsClient.addWantsItem(printingId, 1, 'medium');
    if (result.success) {
      toast({ title: "Added to wants", description: cardName });
    } else {
      toast({ title: "Failed to add to wants", description: result.error, variant: "destructive" });
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

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Dormant HUD trigger */}
      {!chordMode && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={() => setChordMode('select')}
            className="flex items-center gap-2.5 bg-black/40 border border-blue-400/60 rounded-full px-5 py-2 text-sm text-gray-200 hover:text-white hover:border-blue-300/90 hover:bg-black/55 backdrop-blur-md shadow-[0_0_12px_rgba(96,165,250,0.25)] hover:shadow-[0_0_18px_rgba(96,165,250,0.4)] transition-all duration-200 group"
          >
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px] border border-white/20 group-hover:text-white transition-colors">{modKey}K</kbd>
            <span>Deck Tools</span>
            <span className="text-blue-400/70 group-hover:text-blue-300 transition-colors">▸</span>
          </button>
        </div>
      )}

      {/* Chord mode HUD — shown when Cmd/Ctrl+K is pressed */}
      {chordMode && (() => {
        const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const scrollRed = () => scrollTo('deck-section-red');
        const EQUIPMENT_KW = new Set(['battleworn', 'arcane barrier', 'blade break', 'cloaked', 'modular', 'spellvoid', 'quell', 'temper', 'unity', 'guardwell']);
        const scrollForKw = (kw: string) => EQUIPMENT_KW.has(kw) ? window.scrollTo({ top: 0, behavior: 'smooth' }) : scrollRed();
        const SELECT_ACTIONS: Record<string, () => void> = {
          '0': () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setChordMode(null); },
          '1': () => { scrollTo('deck-section-red'); setChordMode(null); },
          '2': () => { scrollTo('deck-section-yellow'); setChordMode(null); },
          '3': () => { scrollTo('deck-section-blue'); setChordMode(null); },
          '4': () => { scrollTo('deck-section-inventory'); setChordMode(null); },
          '7': () => { setQuickAddTarget({ category: 'benched' as DeckCategory }); setChordMode(null); },
          '8': () => { setQuickAddTarget({ category: 'inventory' }); setChordMode(null); },
          '9': () => { setQuickAddTarget({ category: 'maindeck' }); setChordMode(null); },
          'A': () => setChordMode('attack'),
          'C': () => setChordMode('cost'),
          'D': () => { if (activeTab !== 'deck') { setActiveTab('deck'); setChordMode(null); } else setChordMode('defense'); },
          'T': () => setChordMode('type'),
          'K': () => { setChordMode('keyword'); setKeywordBuffer(''); },
          'F': () => setChordMode('clear'),
          'W': () => setChordMode('arcane'),
          'S': () => { setChordMode('nameFilter'); setKeywordBuffer(''); },
          'M': () => { router.push(`/decks/${deckId}/matchups`); setChordMode(null); },
          'O': () => { window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter: 'owned' } })); setChordMode(null); },
          'U': () => { window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter: 'unowned' } })); setChordMode(null); },
        };
        const STAT_MAP: Record<string, string> = { attack: 'power', cost: 'cost', defense: 'defense', arcane: 'arcane' };
        // ── Deck distribution map for chip frequency bars ──────────────────────
        const statField = STAT_MAP[chordMode!];
        const deckDistMap = new Map<number, number>();
        if (statField && chordMode !== 'type') {
          const allCards = [
            ...(state.deck?.maindeck ?? []),
            ...(state.deck?.equipment ?? []),
            ...(state.deck?.inventory ?? []),
          ];
          for (const card of allCards) {
            const val = (card.printingDetails as Record<string, unknown>)?.[statField];
            if (val != null && typeof val === 'number') {
              deckDistMap.set(val, (deckDistMap.get(val) ?? 0) + (card.quantity ?? 1));
            }
          }
        }
        const maxDistCount = deckDistMap.size > 0 ? Math.max(...Array.from(deckDistMap.values())) : 0;
        const activeVals = activeHighlights.get(statField ?? '') ?? new Set<number | string>();
        // ── Type distribution map for type chips ───────────────────────────────
        const typeDistMap = new Map<string, number>();
        if (chordMode === 'type') {
          const allCards = [
            ...(state.deck?.maindeck ?? []),
            ...(state.deck?.equipment ?? []),
            ...(state.deck?.inventory ?? []),
          ];
          for (const card of allCards) {
            const types = (card.printingDetails?.types ?? []) as string[];
            const qty = card.quantity ?? 1;
            for (const t of types) typeDistMap.set(t, (typeDistMap.get(t) ?? 0) + qty);
          }
        }
        const activeTypeVals = activeHighlights.get('type') ?? new Set<number | string>();
        const TYPE_KEYS: Record<string, string> = { A: 'attack', N: 'non-attack', I: 'item', T: 'instant', D: 'defense-reaction', R: 'attack-reaction', E: 'equipment', W: 'weapon', G: 'generic', B: 'block', M: 'item', Z: 'ally', S: 'base', U: 'aura', V: 'evo', C: heroClass };
        const hudBtn = "flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 -mx-1.5 hover:bg-gray-700/60 transition-colors";
        const isOverlayMode = chordMode === 'type' || chordMode === 'attack' || chordMode === 'cost' || chordMode === 'defense' || chordMode === 'arcane';
        const exitChord = () => {
          setChordExiting(true);
          setTimeout(() => { setChordMode(null); setKeywordBuffer(''); setChordExiting(false); }, 160);
        };
        const overlayChips: { key: string; label: string }[] = chordMode === 'type'
          ? [
              { key: 'A', label: 'Attack' },
              { key: 'N', label: 'Non-Attack' },
              { key: 'I', label: 'Item' },
              { key: 'T', label: 'Instant' },
              { key: 'D', label: 'Def Reaction' },
              { key: 'R', label: 'Atk Reaction' },
              { key: 'E', label: 'Equipment' },
              { key: 'W', label: 'Weapon' },
              { key: 'B', label: 'Block' },
              //ideally ally, evo, base, aura only shows up as an option when there are ally cards in a card pool of the hero
              { key: 'Z', label: 'Ally' },
              { key: 'U', label: 'Aura' },
              { key: 'S', label: 'Base' },
              { key: 'V', label: 'Evo' }, 
              { key: 'G', label: 'Generic' },
              ...(heroClass ? [{ key: 'C', label: heroClass.charAt(0).toUpperCase() + heroClass.slice(1) }] : []),
            ]
          : chordMode === 'arcane'
          ? [1,2,3,4,5,6,7,8,9].map(n => ({ key: String(n), label: String(n) }))
          : isOverlayMode
          ? [0,1,2,3,4,5,6,7,8,9].map(n => ({ key: String(n), label: String(n) }))
          : [];
        return (
          <>
            {/* Sub-mode chip overlay (type / attack / cost / defense / arcane) */}
            {isOverlayMode && !keywordBuffer.startsWith('-') && (
              <div
                className="fixed left-1/2 -translate-x-1/2 z-50"
                style={{ bottom: '76px', width: chordMode === 'type' ? 'min(820px, 96vw)' : 'min(620px, 96vw)' }}
              >
                <div className="bg-gray-950 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden">

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-base font-medium text-gray-200 hover:text-white transition-colors rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950"
                      onClick={() => setChordMode('select')}
                      aria-label="Back to Deck Tools menu"
                    >
                      ← Back
                    </button>
                    <span className="text-base font-bold text-white tracking-wide">
                      {{ attack: 'Attack Power', cost: 'Card Cost', defense: 'Defense Value', type: 'Card Type', arcane: 'Arcane Damage' }[chordMode]}
                    </span>
                    <span className="text-sm text-gray-300 text-right max-w-[180px] leading-tight">
                      {chordMode === 'type' ? 'Click a type or press its key' : 'Click a value to highlight matching cards'}
                    </span>
                  </div>

                  {/* Chip grid */}
                  <div
                    className="grid gap-2 p-4"
                    style={{ gridTemplateColumns: chordMode === 'type' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)' }}
                  >
                    {overlayChips.map((chip, i) => {
                      const isNumeric = chordMode !== 'type';
                      const chipNum = isNumeric ? parseInt(chip.key) : NaN;
                      const typeVal = !isNumeric ? TYPE_KEYS[chip.key] : '';
                      const chipCount = isNumeric ? (deckDistMap.get(chipNum) ?? 0) : (typeDistMap.get(typeVal) ?? 0);
                      const isZero = (isNumeric ? maxDistCount > 0 : typeDistMap.size > 0) && chipCount === 0;
                      const isActive = isNumeric ? activeVals.has(chipNum) : activeTypeVals.has(typeVal);
                      const lo = Math.min(hudRangeMin, hudRangeMax);
                      const hi = Math.max(hudRangeMin, hudRangeMax);
                      const inRange = isNumeric && !isNaN(chipNum) && chipNum >= lo && chipNum <= hi;
                      // 4 muted color groups — SC 1.4.1 compliant: text label is the non-color cue
                      // Background intensity scales with card count (heatmap): 10%–40% opacity range
                      type TypeTheme = { rgb: string; border: string; kbd: string };
                      const TYPE_GROUP: Record<string, TypeTheme> = {
                        A: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        N: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        R: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        D: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        B: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        E: { rgb: '120,53,15',   border: 'border-amber-700/45',  kbd: 'bg-amber-950/80 border-amber-700/60' },
                        W: { rgb: '120,53,15',   border: 'border-amber-700/45',  kbd: 'bg-amber-950/80 border-amber-700/60' },
                        I: { rgb: '120,53,15',   border: 'border-amber-700/45',  kbd: 'bg-amber-950/80 border-amber-700/60' },
                        T: { rgb: '30,58,138',   border: 'border-blue-700/45',   kbd: 'bg-blue-950/80 border-blue-700/60' },
                        G: { rgb: '30,58,138',   border: 'border-blue-700/45',   kbd: 'bg-blue-950/80 border-blue-700/60' },
                        S: { rgb: '30,58,138',   border: 'border-blue-700/45',   kbd: 'bg-blue-950/80 border-blue-700/60' },
                        Z: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                        U: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                        V: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                        C: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                      };
                      const theme: TypeTheme = TYPE_GROUP[chip.key] ?? { rgb: '75,85,99', border: 'border-gray-600/50', kbd: 'bg-gray-900 border-gray-500' };
                      // Heatmap: scale bg opacity from 0.08 (floor) to 0.42 (ceiling) based on count ratio
                      const typeMaxCount = typeDistMap.size > 0 ? Math.max(...Array.from(typeDistMap.values())) : 0;
                      const heatRatio = !isNumeric && typeMaxCount > 0 && !isZero ? chipCount / typeMaxCount : 0;
                      const numHeatRatio = isNumeric && maxDistCount > 0 && !isZero ? chipCount / maxDistCount : 0;
                      const bgOpacity = isZero ? 0.07 : (!isNumeric ? 0.10 + heatRatio * 0.32 : 0.08 + numHeatRatio * 0.22);
                      const heatBg = !isNumeric
                        ? { backgroundColor: `rgba(${theme.rgb}, ${bgOpacity})` }
                        : { backgroundColor: `rgba(59,130,246, ${bgOpacity})` }; // numeric: subtle blue scale
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          aria-label={chordMode === 'type' ? chip.label : `Highlight ${STAT_MAP[chordMode!] ?? chordMode} ${chip.key}`}
                          className={`${chordExiting ? 'chord-chip-exit' : 'chord-chip-enter'} relative ${
                            chordMode === 'type'
                              ? `flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border transition-all ${
                                  isActive
                                    ? `border-amber-400/80 border-t-[3px]`
                                    : isZero
                                    ? `${theme.border} border-dashed`
                                    : `${theme.border} hover:brightness-125`
                                }`
                              : `flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-xl border transition-all ${
                                  isActive
                                    ? 'border-amber-400/80 border-t-[3px]'
                                    : inRange
                                    ? 'border-amber-600/60 border-t-[3px] border-t-amber-500'
                                    : isZero
                                    ? 'border-gray-600/40 border-dashed'
                                    : 'border-blue-800/40 hover:brightness-125'
                                }`
                          } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950`}
                          style={{ animationDelay: chordExiting ? '0ms' : `${i * 22}ms`, ...heatBg }}
                          onClick={() => {
                            if (chordMode === 'type') {
                              const val = TYPE_KEYS[chip.key];
                              if (val) {
                                window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'type', value: val } }));
                                scrollRed();
                              }
                            } else {
                              const n = parseInt(chip.key);
                              window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: STAT_MAP[chordMode!], value: n } }));
                              scrollRed();
                            }
                            exitChord();
                          }}
                        >
                          {chordMode === 'type' ? (
                            <>
                              {isActive && (
                                <span className="absolute top-1.5 right-2 text-xs font-bold text-amber-300" aria-hidden="true">✓</span>
                              )}
                              <kbd className={`px-2.5 py-1 rounded-md font-sans text-base font-bold tracking-wide border min-w-[34px] text-center flex-shrink-0 ${theme.kbd} text-white`}>{chip.key}</kbd>
                              <span className={`text-base font-semibold truncate text-center leading-tight ${isActive ? 'text-amber-200' : isZero ? 'text-gray-300' : 'text-white'}`}>{chip.label}</span>
                              <span className={`text-base leading-none tabular-nums font-medium ${isZero ? 'text-gray-300' : isActive ? 'text-amber-300' : 'text-gray-200'}`}>{chipCount}×</span>
                            </>
                          ) : (
                            <>
                              {isActive && (
                                <span className="absolute top-1.5 right-2 text-xs font-bold text-amber-300" aria-hidden="true">✓</span>
                              )}
                              {inRange && !isActive && (
                                <span className="absolute top-1.5 right-2 text-xs font-bold text-amber-400" aria-hidden="true">~</span>
                              )}
                              <span className={`text-4xl font-mono font-bold leading-none select-none ${isZero ? 'text-gray-400' : isActive ? 'text-amber-300' : inRange ? 'text-amber-100' : 'text-white'}`}>{chip.key}</span>
                              {maxDistCount > 0 && (
                                <span className={`text-base leading-none tabular-nums font-medium ${isZero ? 'text-gray-300' : isActive ? 'text-amber-300' : 'text-gray-200'}`}>{chipCount}×</span>
                              )}
                              {maxDistCount > 0 && (
                                <div className="w-full h-1 rounded-full bg-gray-700 mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${isActive ? 'bg-amber-400' : inRange ? 'bg-amber-500' : 'bg-blue-500'}`}
                                    style={{ width: `${(chipCount / maxDistCount) * 100}%` }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Range picker — issue 4: proportional button; issue 7: consistent visual language */}
                  {chordMode !== 'type' && (() => {
                    const lo = Math.min(hudRangeMin, hudRangeMax);
                    const hi = Math.max(hudRangeMin, hudRangeMax);
                    let rangeCardCount = 0;
                    for (let v = lo; v <= hi; v++) rangeCardCount += deckDistMap.get(v) ?? 0;
                    return (
                      <div className="border-t border-gray-700 bg-gray-900/60 px-5 py-4 flex items-center gap-4 flex-wrap">
                        <span className="text-base font-medium text-gray-200 flex-shrink-0">Highlight range:</span>
                        <select
                          value={hudRangeMin}
                          onChange={e => setHudRangeMin(Number(e.target.value))}
                          className="bg-gray-800 text-white text-base rounded-lg border border-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                        >
                          {overlayChips.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <span className="text-base font-medium text-gray-300 flex-shrink-0">to</span>
                        <select
                          value={hudRangeMax}
                          onChange={e => setHudRangeMax(Number(e.target.value))}
                          className="bg-gray-800 text-white text-base rounded-lg border border-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                        >
                          {overlayChips.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <button
                          type="button"
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-base font-semibold rounded-lg transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          onClick={() => {
                            const stat = STAT_MAP[chordMode!];
                            for (let v = lo; v <= hi; v++) {
                              window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat, value: v, additive: true } }));
                            }
                            scrollRed();
                            exitChord();
                          }}
                        >
                          Apply range{rangeCardCount > 0 ? ` (${rangeCardCount} cards)` : ''}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Main HUD bar */}
            <div
              className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-200"
              style={{ width: chordMode === 'select' ? 'min(880px, 96vw)' : undefined }}
            >
              {chordMode === 'select' ? (
                /* ── Grouped select mode panel ── */
                <div className="px-6 py-5">
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{modKey}K · Deck Tools</span>
                    <span className="text-xs text-gray-500">press a key or click an action</span>
                    <button type="button" className="text-xs text-gray-500 hover:text-gray-200 transition-colors px-2 py-0.5 rounded hover:bg-gray-700" onClick={() => setChordMode(null)}>
                      <span className="hidden sm:inline">✕ Esc</span>
                      <span className="sm:hidden">✕ Close</span>
                    </button>
                  </div>
                  {/* Four-column group layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-0 divide-x divide-gray-700/40">
                    {/* Navigate */}
                    <div className="pr-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Navigate to</div>
                      {[
                        { key: '0', label: 'Scroll to top' },
                        { key: '1', label: 'Red (1) section', color: 'text-red-400' },
                        { key: '2', label: 'Yellow (2) section', color: 'text-yellow-400' },
                        { key: '3', label: 'Blue (3) section', color: 'text-blue-400' },
                        { key: '4', label: 'Inventory section' },
                      ].map(({ key, label, color }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className={`text-sm ${color || 'text-gray-300'}`}>{label}</span>
                        </button>
                      ))}
                    </div>
                    {/* Highlight */}
                    <div className="px-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Highlight cards by</div>
                      {[
                        { key: 'A', label: 'Attack power', sub: true },
                        { key: 'C', label: 'Card cost', sub: true },
                        ...(activeTab === 'deck' ? [{ key: 'D', label: 'Defense value', sub: true }] : []),
                        { key: 'T', label: 'Card type', sub: true },
                        { key: 'K', label: 'Keyword', sub: true },
                        { key: 'W', label: 'Arcane damage', sub: true },
                        { key: 'S', label: 'Name search' },
                        { key: 'F', label: 'Clear all filters' },
                      ].map(({ key, label, sub }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className="text-sm text-gray-300 flex-1">{label}</span>
                          {sub && <span className="text-xs text-gray-500">▸</span>}
                        </button>
                      ))}
                    </div>
                    {/* Add Cards */}
                    <div className="px-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Add cards to</div>
                      {[
                        { key: '9', label: 'Maindeck' },
                        { key: '8', label: 'Inventory' },
                        { key: '7', label: 'Bench' },
                      ].map(({ key, label }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className="text-sm text-gray-300">+ {label}</span>
                        </button>
                      ))}
                    </div>
                    {/* View */}
                    <div className="pl-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Switch view</div>
                      {[
                        { key: 'M', label: 'Matchups tab' },
                        ...(activeTab !== 'deck' ? [{ key: 'D', label: 'Deck tab' }] : []),
                        { key: 'O', label: 'Owned cards only', color: 'text-green-400' },
                        { key: 'U', label: 'Unowned cards', color: 'text-red-400' },
                      ].map(({ key, label, color }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className={`text-sm ${color || 'text-gray-300'}`}>{label}</span>
                        </button>
                      ))}
                      {/* Tile size stepper */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-700/30">
                        <span className="text-xs text-gray-500 flex-1">Tile size</span>
                        <button
                          type="button"
                          disabled={tileSize.idx === 0}
                          onClick={() => window.dispatchEvent(new CustomEvent('deck-tile-size', { detail: { direction: 'smaller' } }))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
                        >−</button>
                        <span className="text-sm text-gray-200 min-w-[52px] text-center">{tileSize.label}</span>
                        <button
                          type="button"
                          disabled={tileSize.idx === tileSize.total - 1}
                          onClick={() => window.dispatchEvent(new CustomEvent('deck-tile-size', { detail: { direction: 'larger' } }))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Sub-mode bar ── */
                <div className="flex items-center gap-3 text-sm text-gray-200 px-4 py-3 flex-wrap">
                  {/* Breadcrumb back button */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    onClick={() => setChordMode('select')}
                  >
                    <span>←</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono text-xs border border-gray-600">{modKey}K</kbd>
                    <span className="text-gray-600">→</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 font-mono text-xs border border-gray-500">
                      {{ attack: 'A', cost: 'C', defense: 'D', type: 'T', keyword: 'K', clear: 'F', arcane: 'W', nameFilter: 'S' }[chordMode!]}
                    </kbd>
                  </button>
                  <div className="w-px h-5 bg-gray-700 flex-shrink-0" />

                  {isOverlayMode && !keywordBuffer.startsWith('-') && (
                    <span className="text-xs text-gray-400">
                      {{ attack: 'Attack Power', cost: 'Card Cost', defense: 'Defense', type: 'Card Type', arcane: 'Arcane Damage' }[chordMode]}
                    </span>
                  )}
                  {isOverlayMode && keywordBuffer.startsWith('-') && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400">
                      Range: <kbd className="px-1.5 py-0.5 rounded bg-gray-800 font-mono text-xs border border-amber-600/60 min-w-[48px] text-center">{keywordBuffer || '…'}</kbd>
                      <span className="text-gray-500 text-[10px]">e.g. -4-6</span>
                    </span>
                  )}
                  {chordMode === 'keyword' && (() => {
                    const matches = (KEYWORDS as readonly string[]).filter(k => k.startsWith(keywordBuffer));
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">Type to filter:</span>
                        <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-100 font-mono text-xs border border-gray-600 min-w-[60px]">
                          {keywordBuffer || '…'}
                        </kbd>
                        <span className="text-[10px] text-gray-500">({matches.length} match{matches.length !== 1 ? 'es' : ''})</span>
                        <div className="flex gap-1.5 flex-wrap max-w-[500px]">
                          {matches.slice(0, 12).map(k => (
                            <button key={k} type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white cursor-pointer transition-colors" onClick={() => {
                              window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'keyword', value: k } }));
                              scrollForKw(k);
                              setChordMode(null);
                              setKeywordBuffer('');
                            }}>
                              {k}
                            </button>
                          ))}
                          {matches.length > 12 && <span className="text-[10px] text-gray-500">+{matches.length - 12}</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {chordMode === 'nameFilter' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Filter by name:</span>
                      <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-100 font-mono text-xs border border-gray-600 min-w-[120px]">
                        {keywordBuffer || '…'}
                      </kbd>
                      <span className="text-[10px] text-gray-500">Enter to apply</span>
                    </div>
                  )}
                  {chordMode === 'clear' && (
                    <button type="button" className={hudBtn} onClick={() => {
                      window.dispatchEvent(new CustomEvent('deck-highlight-clear'));
                      setChordMode(null);
                    }}>
                      <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-xs border border-gray-600 min-w-[20px] text-center">0</kbd>
                      <span className="text-xs text-gray-400">Clear all filters</span>
                    </button>
                  )}
                  <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
                  <button type="button" className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors" onClick={() => setChordMode(null)}>Esc to close</button>
                </div>
              )}
            </div>
          </>
        );
      })()}

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
            {/* Compact header: back arrow + title + view link */}
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/decks"
                className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                <span className="hidden sm:inline-flex text-sm px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shrink-0 ml-1">
                  {state.deck.format}
                </span>
              )}
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0">
                {!canEdit && (
                  <span className="text-sm text-gray-600 dark:text-gray-300">Read only</span>
                )}
                <DarkModeToggle />
                {state.deck && (
                  <DeckToolbarMoreMenu
                    isOwner={isOwner}
                    onCopyList={() => {
                      const text = buildDeckExportText(state.deck!);
                      navigator.clipboard.writeText(text).then(() => {
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                        toast({ title: "Copied!", description: "Deck list copied to clipboard." });
                      });
                    }}
                    onExport={() => {
                      const text = buildDeckExportText(state.deck!);
                      const blob = new Blob([text], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${state.deck!.name || "deck"}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    onAnalyze={() => router.push(`/decks/${deckId}/analyze`)}
                    onPresent={() => router.push(`/decks/${deckId}/present`)}
                    onSettings={() => setSettingsOpen(true)}
                    onUpdateOwnedPrintings={canEdit ? handleUpgradePrintings : undefined}
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
            <div className="hidden sm:flex border-b border-gray-200 dark:border-gray-700 mb-4">
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
                {(state.deckCounts.equipment + state.deckCounts.maindeck + state.deckCounts.inventory) > 0 && (
                  <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                    {state.deckCounts.equipment + state.deckCounts.maindeck + state.deckCounts.inventory}/80
                  </span>
                )}
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
            {canEdit && (buildsLoading || curatedBuilds.length > 0 || heroCurators.some(c => c.metafyProductUrl)) && (() => {
              const curatorsWithMetafy = heroCurators.filter(c => c.metafyProductUrl);
              return (
                <div className="mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={buildsLoading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                        <span className="font-medium">Starter Kits</span>
                        {!buildsLoading && curatedBuilds.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{curatedBuilds.length}</span>
                        )}
                        {buildsLoading
                          ? <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" aria-hidden="true" />
                          : <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
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
                  </DropdownMenu>
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
                    className="flex items-center gap-3 mb-6 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
                      className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
                  {/* Slim deck stats bar — pulled out of the right rail so the rail can dedicate its space
                      to the (sticky) hovered-card preview without competing for attention. */}
                  {railStats && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                      {[
                        { label: 'Red', count: railStats.pitchCounts.red, dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
                        { label: 'Yellow', count: railStats.pitchCounts.yellow, dot: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
                        { label: 'Blue', count: railStats.pitchCounts.blue, dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
                        { label: 'No Pitch', count: railStats.pitchCounts.none ?? 0, dot: 'bg-gray-400', text: 'text-gray-700 dark:text-gray-300' },
                      ].filter(p => p.count > 0).map(p => (
                        <span
                          key={p.label}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60"
                        >
                          <span className={cn("w-2 h-2 rounded-full", p.dot)} aria-hidden="true" />
                          <span className={cn("font-semibold tabular-nums", p.text)}>{p.count}</span>
                          <span className="text-gray-600 dark:text-gray-400">{p.label}</span>
                        </span>
                      ))}
                      {railStats.averageCost != null && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 text-gray-700 dark:text-gray-200">
                          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg Cost</span>
                          <span className="font-semibold tabular-nums">{railStats.averageCost.toFixed(1)}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <DeckEditorListView
                    deck={state.deck}
                    ownershipMap={state.ownershipMap}
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
                    onAddCard={(category, pitch) => setQuickAddTarget({ category, pitch })}
                    canEdit={canEdit}
                    binders={binders}
                    selectedBinderId={selectedBinderId}
                    onBinderChange={handleBinderChange}
                    onAddToBinder={handleAddToBinder}
                    onAddToWants={handleAddToWants}
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

              </div>
              {activeTab === "deck" && state.deck && railStats && (
                <DeckRightRail
                  ownedCount={railStats.ownedCount}
                  totalCount={railStats.totalCount}
                  hoveredCard={hoveredCard}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {isOwner && state.deck && (
        <DeckSettings
          deck={{
            _id: deckId,
            name: state.deck.name,
            description: state.deck.description,
            format: state.deck.format,
            hero: state.deck.heroName,
            visibility: state.deck.visibility,
            isPublic: state.deck.visibility === 'public',
            availableOnTalishar: state.deck.availableOnTalishar,
            metafyGuideId: state.deck.metafyGuideId,
            eventName: state.deck.eventName,
            eventDate: state.deck.eventDate,
            placing: state.deck.placing,
          }}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={handleSaveSettings}
          loading={settingsSaving}
          deckId={deckId}
          fullDeck={state.deck}
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

      {/* Mobile bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex sm:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {canEdit && (
          <button
            onClick={() => setActiveTab("search")}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
              activeTab === "search"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            <LayoutGrid className="h-5 w-5" />
            Cards
          </button>
        )}
        <button
          onClick={() => setActiveTab("deck")}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative",
            activeTab === "deck"
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
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
          className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          <Swords className="h-5 w-5" />
          Matchups
        </Link>
        {canEdit && (
          <button
            onClick={() => setActiveTab("results")}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
              activeTab === "results"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            <Trophy className="h-5 w-5" />
            Results
          </button>
        )}
      </div>

      {/* Dialog: quick-add a single card to a specific zone */}
      <QuickAddCardDialog
        open={!!quickAddTarget}
        onOpenChange={isOpen => !isOpen && setQuickAddTarget(null)}
        onAdd={handleQuickAddCard}
        targetCategory={quickAddTarget?.category ?? "maindeck"}
        pitchFilter={quickAddTarget?.pitch}
        deckFormat={state.deck?.format}
        currentDeck={state.deck ?? undefined}
      />

      {/* Upgrade printings — confirmation */}
      {showUpgradeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowUpgradeConfirm(false)}>
          <div className="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <span className="text-white font-semibold">Update to Owned Printings</span>
              <button onClick={() => setShowUpgradeConfirm(false)} className="text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-gray-300 text-sm">This will replace the current printings in your deck with printings you own in your binders, for any card where you have a matching owned printing.</p>
              <p className="text-gray-400 text-sm mt-2">Cards without an owned alternative will not be changed.</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-700 flex gap-2 justify-end">
              <button onClick={() => setShowUpgradeConfirm(false)} className="text-sm px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Cancel
              </button>
              <button onClick={doUpgradePrintings} className="text-sm px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade printings result modal */}
      {upgradeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setUpgradeResult(null)}>
          <div className="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <span className="text-white font-semibold">Printings Updated</span>
              <button onClick={() => setUpgradeResult(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-3 max-h-80 overflow-y-auto">
              <p className="text-gray-400 text-xs mb-3">{upgradeResult.length} card{upgradeResult.length !== 1 ? "s" : ""} swapped to owned printings</p>
              <ul className="space-y-1">
                {upgradeResult.map((c, i) => (
                  <li key={i} className="text-sm text-gray-200">
                    {c.cardName}{c.color ? <span className="ml-1 text-gray-400 text-xs">({c.color})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-5 py-3 border-t border-gray-700">
              <button onClick={() => setUpgradeResult(null)} className="w-full text-sm py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
                      defaultQty={qty}
                      deckQty={cardSplits.get(card.printingId)?.deck ?? qty}
                      inventoryQty={cardSplits.get(card.printingId)?.inventory ?? 0}
                      onDeckQtyChange={q => setCardSplits(prev => new Map(prev).set(card.printingId, { deck: q, inventory: prev.get(card.printingId)?.inventory ?? 0 }))}
                      onInventoryQtyChange={q => setCardSplits(prev => new Map(prev).set(card.printingId, { deck: prev.get(card.printingId)?.deck ?? qty, inventory: q }))}
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
