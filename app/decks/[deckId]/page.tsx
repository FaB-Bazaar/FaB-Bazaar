"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, Search, List, X, Swords, LayoutGrid, Eye, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeckEditor } from "@/hooks/deck/useDeckEditor";
import type { SwapTarget } from "@/hooks/deck/useDeckEditor";
import type { DeckCategory, DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";
import { decksClient, bindersClient } from "@/lib/client";
import { upgradeToOwnedPrintings } from "@/lib/client/decks-client";
import DeckEditorSidebar from "@/components/deck/editor/DeckEditorSidebar";
import DeckEditorListView from "@/components/deck/editor/DeckEditorListView";
import DeckMatchupsDialog from "@/components/deck/DeckMatchupsDialog";
import QuickAddCardDialog from "@/components/deck/editor/QuickAddCardDialog";
import MobileCardSearch from "@/components/deck/editor/MobileCardSearch";
import BulkImportForm from "@/components/browse/BulkImportForm";
import BulkResultsGrid from "@/components/browse/BulkResultsGrid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ViewPrintingsDialog from "@/components/dialogs/cards/view-printings-dialog";
import { cn } from "@/lib/utils";

export default function DeckEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const deckId = params.deckId as string;

  const { state, handlers } = useDeckEditor(deckId);

  // Tab state
  const [activeTab, setActiveTab] = useState<"search" | "deck" | "matchups">("deck");

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
    cards: Array<{ printingId: string; displayName?: string }>;
    children?: Array<{ id: string; name: string; cards: Array<{ printingId: string; displayName?: string }> }>;
  }>>([]);

  // Active popover for build buttons
  const [activeBuildPopover, setActiveBuildPopover] = useState<string | null>(null);

  // Search form collapse state
  const [searchFormOpen, setSearchFormOpen] = useState(true);

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
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setCuratedBuilds(data.data ?? []);
        }
      })
      .catch(() => {});
  }, [state.deck?.heroName, state.deck?._id, state.deck?.hero]);

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

  const [applyingBuild, setApplyingBuild] = useState(false);

  const applyBuild = async (cardList: Array<{ printingId: string; displayName?: string }> | undefined) => {
    if (!cardList?.length || !isOwner) return;
    setApplyingBuild(true);
    setActiveBuildPopover(null);
    try {
      // Group by printingId to calculate quantities
      const quantities = new Map<string, number>();
      for (const card of cardList) {
        quantities.set(card.printingId, (quantities.get(card.printingId) ?? 0) + 1);
      }
      const printings = Array.from(quantities.entries()).map(([printingId, quantity]) => ({
        printingId,
        quantity,
        category: 'maindeck' as DeckCategory,
      }));
      const result = await decksClient.addPrintings(deckId, printings);
      if (result.success) {
        toast({ title: 'Cards added', description: `${cardList.length} card(s) added to your deck.` });
        await handlers.refreshDeck();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } finally {
      setApplyingBuild(false);
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

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
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
                <span className="text-xs text-muted-foreground">
                  {!isOwner
                    ? "Read only"
                    : state.deck?.heroName
                    ? `Filtered for ${state.deck.heroName}`
                    : ""}
                </span>
              </div>
            </div>

            {/* Curated build buttons — visible on all tabs */}
            {isOwner && curatedBuilds.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                  Suggested Builds
                </span>
                <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 shrink-0" />
                {curatedBuilds.map(build => (
                  build.children && build.children.length > 1 ? (
                    <Popover key={build.id} open={activeBuildPopover === build.id} onOpenChange={open => setActiveBuildPopover(open ? build.id : null)}>
                      <PopoverTrigger asChild>
                        <button disabled={applyingBuild} className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors font-medium flex items-center gap-1 shadow-sm disabled:opacity-50">
                          {build.name}
                          <span className="text-[10px] opacity-60">▾</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="start">
                        <div className="space-y-0.5">
                          {build.children.map(child => (
                            <button
                              key={child.id}
                              onClick={() => applyBuild(child.cards)}
                              className="w-full text-left text-sm px-3 py-2 rounded hover:bg-muted transition-colors"
                            >
                              {child.name}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <button
                      key={build.id}
                      disabled={applyingBuild}
                      onClick={() => applyBuild(build.children?.length === 1 ? build.children[0].cards : build.cards)}
                      className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors font-medium shadow-sm disabled:opacity-50"
                    >
                      {applyingBuild ? <Loader2 className="h-3 w-3 animate-spin inline" /> : build.name}
                    </button>
                  )
                ))}
              </div>
            )}

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
            </div>

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
                    onAddCard={(category, pitch) => setQuickAddTarget({ category, pitch })}
                    canEdit={isOwner}
                    binders={binders}
                    selectedBinderId={selectedBinderId}
                    onBinderChange={handleBinderChange}
                    onAddToBinder={handleAddToBinder}
                    onUpgradePrintings={handleUpgradePrintings}
                  />
                ) : null}
              </>
            )}

            {/* Matchups tab content — always mounted once deck loads to avoid refetch on tab switch */}
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
    </div>
  );
}
