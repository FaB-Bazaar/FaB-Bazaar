"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, Search, List, X, Swords, LayoutGrid, Eye, Sparkles, Trophy, ChevronDown, ExternalLink, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeckEditor } from "@/hooks/deck/useDeckEditor";
import type { SwapTarget } from "@/hooks/deck/useDeckEditor";
import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";
import { KEYWORDS } from "@/lib/fab-constants/keywords";
import { decksClient, bindersClient, wantsClient } from "@/lib/client";
import { upgradeToOwnedPrintings } from "@/lib/client/decks-client";
import DeckEditorSidebar from "@/components/deck/editor/DeckEditorSidebar";
import DeckEditorListView from "@/components/deck/editor/DeckEditorListView";
import DeckMatchupsDialog from "@/components/deck/DeckMatchupsDialog";
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

interface PackageCard {
  printingId: string;
  displayName?: string;
  color?: string;
  setCode?: string;
  imageUrl?: string;
}

function PackageCardItem({
  card,
  defaultQty,
  adding,
  isOwner,
  onAdd,
}: {
  card: PackageCard;
  defaultQty: number;
  adding: boolean;
  isOwner: boolean;
  onAdd: (qty: number) => void;
}) {
  const [qty, setQty] = useState(defaultQty);
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={card.imageUrl || "/cardback.webp"}
        alt={card.displayName ?? card.printingId}
        className="w-full rounded-lg shadow-md"
      />
      <span className="text-gray-300 text-xs text-center leading-tight">
        {card.displayName ?? card.printingId}
      </span>
      {isOwner && (
        <div className="w-full flex items-center gap-1">
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold flex items-center justify-center shrink-0"
          >−</button>
          <input
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={e => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
            className="flex-1 min-w-0 text-center text-xs bg-gray-800 border border-gray-600 rounded text-white h-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => setQty(q => Math.min(99, q + 1))}
            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold flex items-center justify-center shrink-0"
          >+</button>
        </div>
      )}
      {isOwner && (
        <button
          onClick={() => onAdd(qty)}
          disabled={adding}
          className="w-full text-xs px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-1"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Add to Deck
        </button>
      )}
    </div>
  );
}

export default function DeckEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const deckId = params.deckId as string;

  const { state, handlers } = useDeckEditor(deckId);

  // Tab state
  const [activeTab, setActiveTab] = useState<"search" | "deck" | "matchups" | "results">("deck");

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
    cards: Array<{ printingId: string; displayName?: string; color?: string; setCode?: string; imageUrl?: string }>;
  }>>([]);

  // Search form collapse state
  const [searchFormOpen, setSearchFormOpen] = useState(true);

  // Deck settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const handleSaveSettings = async (settings: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    visibility: 'private' | 'unlisted' | 'public';
    isPublic: boolean;
    availableOnTalishar: boolean;
    metafyGuideId: string | null;
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

  const stagedCards = state.bulkResults.filter(c => c.isStaged);

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

  // Fetch curated builds for this hero (or generic lists if no hero set)
  useEffect(() => {
    if (!state.deck) return;
    const heroName = state.deck.heroName || state.deck.hero?.[0]?.printingDetails?.display_name?.toLowerCase();
    const url = heroName
      ? `/api/curated-lists?heroName=${encodeURIComponent(heroName)}&view=public`
      : `/api/curated-lists?view=public`;
    setBuildsLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setCuratedBuilds(data.data ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setBuildsLoading(false));
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
      if (!chordMode || isTyping) return;

      e.preventDefault();

      if (chordMode === 'select') {
        // Navigation & actions
        if (e.key === '9') { setQuickAddTarget({ category: 'maindeck' }); resetChord(); }
        else if (e.key === '8') { setQuickAddTarget({ category: 'inventory' }); resetChord(); }
        else if (e.key === '7') { setQuickAddTarget({ category: 'benched' as DeckCategory }); resetChord(); }
        else if (e.key.toLowerCase() === 's') { setChordMode('nameFilter'); setKeywordBuffer(''); startTimeout(); }
        else if (e.key.toLowerCase() === 'm') { setActiveTab('matchups'); resetChord(); }
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

      if (chordMode === 'attack') {
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'power', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'cost') {
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'cost', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'defense') {
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
          'i': 'instant',
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
  // ────────────────────────────────────────────────────────────────────────────

  // Redirect only when the deck is private and the viewer isn't the owner
  useEffect(() => {
    if (authLoading || state.deckLoading) return;
    if (!state.deck) return;
    const ownerViewing = user && state.deck.userId === user.id;
    if (!ownerViewing && !state.deck.isPublic) {
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

  const handleUpgradePrintings = async () => {
    const result = await upgradeToOwnedPrintings(deckId);
    if (result.success) {
      if (result.data.total === 0) {
        toast({ title: "All printings up to date", description: "No unowned printings found with owned alternatives." });
      } else {
        toast({
          title: "Printings updated",
          description: `${result.data.swapped} of ${result.data.total} printing${result.data.total !== 1 ? "s" : ""} swapped to owned copies.`,
        });
        await handlers.refreshDeck();
      }
    } else {
      toast({ title: "Update failed", description: result.error, variant: "destructive" });
    }
  };

  const [buildsExpanded, setBuildsExpanded] = useState(true);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [previewBuild, setPreviewBuild] = useState<{
    name: string;
    cards: Array<{ printingId: string; displayName?: string; color?: string; setCode?: string; imageUrl?: string }>;
  } | null>(null);
  const [addingCard, setAddingCard] = useState<string | null>(null);

  useEffect(() => {
    if (!previewBuild) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewBuild(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewBuild]);

  const addCardToDeck = async (printingId: string, quantity: number, displayName?: string) => {
    if (!isOwner || quantity < 1) return;
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
    <div className="bg-white dark:bg-gray-900 min-h-screen">
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
          'M': () => { setActiveTab('matchups'); setChordMode(null); },
          'O': () => { window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter: 'owned' } })); setChordMode(null); },
          'U': () => { window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter: 'unowned' } })); setChordMode(null); },
        };
        const STAT_MAP: Record<string, string> = { attack: 'power', cost: 'cost', defense: 'defense', arcane: 'arcane' };
        const TYPE_KEYS: Record<string, string> = { A: 'attack', N: 'non-attack', I: 'instant', D: 'defense-reaction', R: 'attack-reaction', E: 'equipment', W: 'weapon', G: 'generic', B: 'block', M: 'item', Z: 'ally', S: 'base', V: 'evo', C: heroClass };
        const hudBtn = "flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 hover:bg-gray-700/60 transition-colors";
        const isOverlayMode = chordMode === 'type' || chordMode === 'attack' || chordMode === 'cost' || chordMode === 'defense' || chordMode === 'arcane';
        const exitChord = () => {
          setChordExiting(true);
          setTimeout(() => { setChordMode(null); setKeywordBuffer(''); setChordExiting(false); }, 160);
        };
        const overlayChips: { key: string; label: string }[] = chordMode === 'type'
          ? [
              { key: 'A', label: 'Attack' },
              { key: 'N', label: 'Non-Attack' },
              { key: 'I', label: 'Instant' },
              { key: 'D', label: 'Def Reaction' },
              { key: 'R', label: 'Atk Reaction' },
              { key: 'E', label: 'Equipment' },
              { key: 'W', label: 'Weapon' },
              { key: 'G', label: 'Generic' },
              { key: 'B', label: 'Block' },
              { key: 'M', label: 'Item' },
              { key: 'Z', label: 'Ally' },
              { key: 'S', label: 'Base' },
              { key: 'V', label: 'Evo' },
              ...(heroClass ? [{ key: 'C', label: heroClass.charAt(0).toUpperCase() + heroClass.slice(1) }] : []),
            ]
          : chordMode === 'arcane'
          ? [1,2,3,4,5,6,7,8,9].map(n => ({ key: String(n), label: String(n) }))
          : isOverlayMode
          ? [0,1,2,3,4,5,6,7,8,9].map(n => ({ key: String(n), label: String(n) }))
          : [];
        return (
          <>
            {isOverlayMode && (
              <div
                className="fixed left-1/2 -translate-x-1/2 z-50"
                style={{ bottom: '76px', width: 'min(500px, 92vw)' }}
              >
                <div className="bg-gray-900/97 border border-gray-700 rounded-2xl shadow-2xl backdrop-blur-sm p-3">
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: chordMode === 'type' ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)' }}
                  >
                    {overlayChips.map((chip, i) => (
                      <button
                        key={chip.key}
                        type="button"
                        className={`${chordExiting ? 'chord-chip-exit' : 'chord-chip-enter'} flex items-center gap-2 px-2.5 py-2.5 rounded-lg bg-gray-800 border border-gray-700/80 hover:bg-gray-700 hover:border-gray-500 cursor-pointer transition-colors`}
                        style={{ animationDelay: chordExiting ? '0ms' : `${i * 22}ms` }}
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
                        <kbd className="px-1.5 py-0.5 rounded bg-gray-900 text-gray-300 font-mono text-xs border border-gray-600 min-w-[20px] text-center flex-shrink-0">{chip.key}</kbd>
                        {chordMode === 'type' && <span className="text-xs text-gray-300 truncate">{chip.label}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl px-5 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-4 text-sm text-gray-200 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {chordMode === 'select' ? `${modKey}K` : `${modKey}K → ${{ attack: 'A', cost: 'C', defense: 'D', type: 'T', keyword: 'K', clear: 'F', arcane: 'W', nameFilter: 'S' }[chordMode!]}`}
                </span>
                <div className="w-px h-6 bg-gray-700" />
                {chordMode === 'select' && [
                  { key: '0', label: 'Top' },
                  { key: '1', label: 'Red', color: 'text-red-400' },
                  { key: '2', label: 'Yellow', color: 'text-yellow-400' },
                  { key: '3', label: 'Blue', color: 'text-blue-400' },
                  { key: '4', label: 'Inventory' },
                  { key: '7', label: '+ Bench' },
                  { key: '8', label: '+ Inventory' },
                  { key: '9', label: '+ Library' },
                  { key: 'A', label: 'Attack' },
                  { key: 'C', label: 'Cost' },
                  { key: 'D', label: activeTab === 'deck' ? 'Defense' : 'Deck' },
                  { key: 'T', label: 'Type' },
                  { key: 'K', label: 'Keyword' },
                  { key: 'F', label: 'Filters' },
                  { key: 'W', label: 'Arcane' },
                  { key: 'S', label: 'Filter' },
                  { key: 'M', label: 'Matchups' },
                  { key: 'O', label: 'Owned', color: 'text-green-400' },
                  { key: 'U', label: 'Unowned', color: 'text-red-400' },
                ].map(({ key, label, color }) => (
                  <button key={key} type="button" className={hudBtn} onClick={() => SELECT_ACTIONS[key]?.()}>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-xs border border-gray-600 min-w-[20px] text-center">{key}</kbd>
                    <span className={`text-xs ${color || 'text-gray-400'}`}>{label}</span>
                  </button>
                ))}
                {isOverlayMode && (
                  <span className="text-xs text-gray-500 italic">
                    {{ attack: 'Attack power', cost: 'Card cost', defense: 'Defense', type: 'Card type', arcane: 'Arcane damage' }[chordMode]} →
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
                <div className="w-px h-6 bg-gray-700" />
                <button type="button" className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors" onClick={() => setChordMode(null)}>Esc to cancel</button>
              </div>
            </div>
          </>
        );
      })()}

      {isOwner && activeTab === "search" && (
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

      <div className={isOwner && activeTab === "search" ? "lg:ml-96" : ""}>
        <div className="container mx-auto pt-3 pb-20 sm:pb-0 px-4">
          <div className="max-w-6xl mx-auto">
            {/* Compact header: back arrow + title + view link */}
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/decks"
                className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"
                title="Back to Decks"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {state.deckLoading ? "Loading..." : state.deck ? state.deck.name : "Deck Editor"}
              </h1>
              <Link
                href={`/decks/${deckId}/analyze`}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0 ml-1"
                title="Analyze deck"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Analyze</span>
              </Link>
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0">
                {state.deck?.format && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {state.deck.format}
                  </span>
                )}
                {isOwner && (
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                    title="Deck settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
                <DarkModeToggle />
                <span className="text-xs text-muted-foreground">
                  {!isOwner
                    ? "Read only"
                    : state.deck?.heroName
                    ? `Filtered for ${state.deck.heroName}`
                    : ""}
                </span>
                {!isOwner && state.deck && (
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
              {isOwner && (
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
                  Search
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
              <button
                onClick={() => setActiveTab("matchups")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "matchups"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                <Swords className="h-4 w-4" />
                Matchups
              </button>
              {isOwner && (
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

            {/* Curated build buttons — collapsible, always reserves space while loading */}
            {isOwner && (buildsLoading || curatedBuilds.length > 0) && (() => {
              const FABLAZING_FORMAT_MAP: Record<string, string> = {
                'Classic Constructed': 'cc',
                'Blitz': 'blitz',
                'Living Legend': 'll',
                'Silver Age': 'sage',
              };
              const heroDisplayName = state.deck?.hero?.[0]?.printingDetails?.display_name ?? state.deck?.heroName ?? null;
              const fablazingFormat = state.deck?.format ? FABLAZING_FORMAT_MAP[state.deck.format] : undefined;
              const fablazingUrl = heroDisplayName ? (() => {
                const params: Record<string, string> = { hero_name: heroDisplayName, page: '1' };
                if (fablazingFormat) params.format = fablazingFormat;
                return `https://fablazing.com/decklists?${new URLSearchParams(params)}`;
              })() : null;
              return (
              <div className="mb-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <button
                  onClick={() => !buildsLoading && setBuildsExpanded(v => !v)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left rounded-t-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  disabled={buildsLoading}
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300 shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex-1">
                    Starter Kits
                    {!buildsLoading && <span className="ml-1.5 font-normal text-blue-500 dark:text-blue-400">({curatedBuilds.length})</span>}
                  </span>
                  {buildsLoading
                    ? <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                    : <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400">
                        {buildsExpanded ? 'collapse' : 'expand'}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", buildsExpanded && "rotate-180")} />
                      </span>
                  }
                </button>
                {buildsExpanded && (
                  <div className="px-3 pb-2 border-t border-blue-200 dark:border-blue-800 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {curatedBuilds.map(build => (
                      <button
                        key={build.id}
                        onClick={() => setPreviewBuild({ name: build.name, cards: build.cards })}
                        className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors font-medium shadow-sm"
                      >
                        {build.name}
                      </button>
                    ))}
                  </div>
                  </div>
                )}
                {fablazingUrl && (
                  <div className="border-t border-blue-200 dark:border-blue-800 px-3 py-1.5">
                    <a
                      href={fablazingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
                    >
                      <img src="/fablazing-logo.svg" alt="Fablazing" className="h-3.5 w-auto bg-gray-900 rounded px-1" />
                      <span>View latest {heroDisplayName} decklists</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
              );
            })()}

            {/* Search tab content */}
            {isOwner && activeTab === "search" && (
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
                    canEdit={isOwner}
                    binders={binders}
                    selectedBinderId={selectedBinderId}
                    onBinderChange={handleBinderChange}
                    onAddToBinder={handleAddToBinder}
                    onAddToWants={handleAddToWants}
                    onUpgradePrintings={handleUpgradePrintings}
                  />
                ) : null}
              </>
            )}

            {/* Results tab content */}
            {isOwner && activeTab === "results" && (
              <DeckResultsTab deckId={deckId} deck={state.deck ?? undefined} />
            )}

            {/* Matchups tab content — visible to all viewers of the deck */}
            {state.deck && (
              <div className={activeTab === "matchups" ? undefined : "hidden"}>
                <DeckMatchupsDialog
                  open={true}
                  onOpenChange={() => {}}
                  deckId={deckId}
                  deck={state.deck}
                  inline={true}
                  compact={true}
                />
              </div>
            )}
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
        {isOwner && (
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
        <button
          onClick={() => setActiveTab("matchups")}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
            activeTab === "matchups"
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400"
          )}
        >
          <Swords className="h-5 w-5" />
          Matchups
        </button>
        {isOwner && (
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

      {/* Package preview modal */}
      {previewBuild && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 overflow-y-auto py-8" onClick={() => setPreviewBuild(null)}>
          <div className="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div>
                <span className="text-white font-semibold text-lg">{previewBuild.name}</span>
                <span className="ml-3 text-gray-400 text-sm">{previewBuild.cards.length} card{previewBuild.cards.length !== 1 ? "s" : ""}</span>
              </div>
              <button onClick={() => setPreviewBuild(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(() => {
                const seen = new Map<string, { card: typeof previewBuild.cards[0]; qty: number }>();
                for (const card of previewBuild.cards) {
                  const existing = seen.get(card.printingId);
                  if (existing) existing.qty++;
                  else seen.set(card.printingId, { card, qty: 1 });
                }
                return Array.from(seen.values()).map(({ card, qty }) => (
                  <PackageCardItem
                    key={card.printingId}
                    card={card}
                    defaultQty={qty}
                    adding={addingCard === card.printingId}
                    isOwner={isOwner}
                    onAdd={q => addCardToDeck(card.printingId, q, card.displayName)}
                  />
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
