// app/decks/[deckId]/analyze/page.tsx
"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import Link from "next/link";
import { ArrowLeft, Plus, Search, RefreshCw, Share2, Eye, EyeOff, Settings, BarChart3, BookOpen, Upload, Swords, Pencil, Copy } from "lucide-react";

// DND-KIT imports
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Deck components
import DeckAnalysis from "@/components/deck/DeckAnalysis";
import DeckFlow from "@/components/deck/DeckFlow";
import DeckExport from "@/components/deck/DeckExport";
import DeckPrintingCard from "@/components/deck/DeckPrintingCard";
import DeckBinderComparison from "@/components/deck/DeckBinderComparison";
import DeckPrintingsGrid from "@/components/deck/DeckPrintingsGrid";
import DeckListView from "@/components/deck/DeckListView";
import DeckBuilderSplitView from "@/components/deck/DeckBuilderSplitView";
import PlaymatView from "@/components/deck/PlaymatView";
import DeckSimulator from "@/components/deck/DeckSimulator";
import DeckMatchupsDialog from "@/components/deck/DeckMatchupsDialog";
import MobileDeckLayout from "@/components/deck/mobile/MobileDeckLayout";
import DeckPageDialogs from "@/components/deck/DeckPageDialogs";

// Hook and types
import { useDeckPage, groupCardsByCardAndCategory } from "@/hooks/deck/useDeckPage";
import type { DeckPrinting } from "@/hooks/deck/useDeckPage";
import { useAuth } from "@/contexts/AuthContext";

function SortablePrintingCard({ printing, children }: { printing: DeckPrinting & { category: string }; children: React.ReactNode }) {
  const uniqueId = printing._id || `${printing.printingId}-${printing.category}-${Date.now()}`;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: uniqueId,
    data: { printing },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
  };

  const childWithProps = React.cloneElement(children as React.ReactElement<any>, {
    dragAttributes: attributes,
    dragListeners: listeners,
    isDragging,
  });

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50 shadow-2xl" : ""}>
      {childWithProps}
    </div>
  );
}

export default function DeckViewPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId as string;
  const [copying, setCopying] = useState(false);
  const [metafyAccessRequired, setMetafyAccessRequired] = useState<string | null>(null);

  const { user } = useAuth();
  const { authLoading, isMobile, state, handlers } = useDeckPage(deckId);

  const {
    loading,
    error,
    saving,
    removingCards,
    movingCards,
    binders,
    selectedBinderId,
    ownershipStatus,
    wantsMap,
    binderMap,
    activeTab,
    searchQuery,
    activeCategory,
    viewMode,
    stackGrouping,
    displayDeck,
    printings,
    canEdit,
    groupedCards,
    filteredPrintings,
    filteredGroupedCards,
    deckStats,
    deckForAnalysis,
    deckCardCounts,
    ownershipRefreshKey,
  } = state;

  const {
    setActiveTab,
    setSearchQuery,
    setActiveCategory,
    setViewMode,
    setStackGrouping,
    setIsCardSearchOpen,
    setSettingsOpen,
    setBulkImportOpen,
    setSwappingPrinting,
    setPrintingSwapOpen,
    setSelectedBinderId,
    setDeck,
    setOptimisticDeck,
    setOwnershipRefreshKey,
    fetchDeck,
    handleDragEnd,
    handleAddPrintingToDeck,
    handleAddAnother,
    handleRemovePrinting,
    handleMovePrinting,
    handleMoveMultiple,
    handleOpenPrintingSwap,
    handleOpenOwnershipComparison,
    handleAddToWants,
    handleAddToBinder,
    handleRemoveFromBinder,
    handleRemoveFromWants,
    handleToggleForTrade,
    handleUpdateTags,
  } = handlers;

  // DND sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Copy deck handler
  const handleCopyDeck = async () => {
    if (!displayDeck) return;
    setCopying(true);
    try {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          copyFromDeckId: displayDeck.publicId,
          name: `${displayDeck.name} (copy)`,
          format: displayDeck.format,
          heroName: displayDeck.heroName,
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.publicId) {
        router.push(`/decks/${data.data.publicId}/analyze`);
      }
    } catch {
      // silently fail
    } finally {
      setCopying(false);
    }
  };

  // Conditional renders
  if (authLoading || loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (error) {
    if (error.startsWith('metafy_access_required:')) {
      const guideId = error.split(':')[1];
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold">This deck requires a Metafy guide purchase</h2>
          <p className="text-muted-foreground max-w-md">
            The deck owner has linked this deck to a Metafy guide. Purchase the guide to unlock access.
          </p>
          <Button asChild>
            <a href={`https://metafy.gg/guides/${guideId}`} target="_blank" rel="noopener noreferrer">
              View Guide on Metafy
            </a>
          </Button>
        </div>
      );
    }
    return <div className="flex justify-center items-center min-h-screen">{error}</div>;
  }
  if (!displayDeck) return <div className="flex justify-center items-center min-h-screen">Deck not found</div>;

  // Shared dialogs appear once, before the mobile/desktop split
  const dialogs = (
    <DeckPageDialogs
      deckId={deckId}
      displayDeck={displayDeck}
      state={state}
      handlers={handlers}
    />
  );

  // MOBILE RENDER
  if (isMobile) {
    return (
      <>
        {dialogs}
        <MobileDeckLayout
          deck={displayDeck as any}
          printings={printings}
          groupedCards={groupedCards}
          filteredPrintings={filteredPrintings}
          filteredGroupedCards={filteredGroupedCards}
          canEdit={!!canEdit}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          ownershipStatus={ownershipStatus}
          wantsMap={wantsMap}
          binderMap={binderMap}
          deckCardCounts={deckCardCounts}
          removingCards={removingCards}
          movingCards={movingCards}
          binders={binders}
          selectedBinderId={selectedBinderId}
          setSelectedBinderId={setSelectedBinderId}
          onRemove={handleRemovePrinting}
          onAddAnother={handleAddAnother}
          onMove={handleMovePrinting}
          onMoveMultiple={handleMoveMultiple}
          onOpenPrintingSwap={handleOpenPrintingSwap}
          onOpenOwnershipComparison={handleOpenOwnershipComparison}
          onAddCard={(category) => {
            setActiveCategory(category);
            setIsCardSearchOpen(true);
          }}
          onAddToWants={handleAddToWants}
          onAddToBinder={handleAddToBinder}
          onSelectCard={handleAddPrintingToDeck}
          onOpenSearch={() => setIsCardSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenBulkImport={() => setBulkImportOpen(true)}
        />
      </>
    );
  }

  // DESKTOP RENDER
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {dialogs}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-2">
          {/* Header */}
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" onClick={() => router.push("/decks")} className="p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{displayDeck.name}</h1>
              <Badge>{displayDeck.format}</Badge>
              <Badge>{displayDeck.isPublic ? "Public" : "Private"}</Badge>
              {displayDeck.heroName && <Badge variant="outline">Hero: {displayDeck.heroName}</Badge>}
              <span className="text-sm text-gray-400">{deckStats.totalCards} cards</span>
              {deckStats.estimatedValue > 0 && (
                <span className="text-sm text-gray-400">~${deckStats.estimatedValue.toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && binders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Default binder:</span>
                  <Select value={selectedBinderId} onValueChange={setSelectedBinderId}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select binder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {binders.map((binder) => (
                        <SelectItem key={binder._id} value={binder._id}>
                          {binder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!canEdit && user && displayDeck.isPublic && (
                <Button variant="outline" size="sm" onClick={handleCopyDeck} disabled={copying}>
                  <Copy className="h-4 w-4 mr-2" />{copying ? "Copying..." : "Copy to My Decks"}
                </Button>
              )}
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setBulkImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />Import Decklist
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />Settings
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Row */}
            <div className="flex items-center gap-3 mb-2">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="simulator">Simulator</TabsTrigger>
                <TabsTrigger value="matchups" className="relative">
                  <Swords className="h-4 w-4 mr-2" />
                  Matchups
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                    NEW
                  </span>
                </TabsTrigger>
                <TabsTrigger value="analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />Analysis
                </TabsTrigger>
                <TabsTrigger value="collection">
                  <BookOpen className="h-4 w-4 mr-2" />Collection
                </TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* View Controls Row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {canEdit && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/decks/${deckId}`}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </Link>
                  </Button>
                )}
                {displayDeck?.hero?.length > 0 && (
                  <Button variant={viewMode === "catalog" ? "default" : "outline"} size="sm" onClick={() => setViewMode("catalog")}>
                    Catalog
                  </Button>
                )}
                <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
                  List
                </Button>
                <Button variant={viewMode === "compact" ? "default" : "outline"} size="sm" onClick={() => setViewMode("compact")}>
                  Compact
                </Button>
                <Button variant={viewMode === "grouped" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grouped")}>
                  Grouped
                </Button>
                <Button variant={viewMode === "individual" ? "default" : "outline"} size="sm" onClick={() => setViewMode("individual")}>
                  Individual
                </Button>
                <Button variant={viewMode === "playmat" ? "default" : "outline"} size="sm" onClick={() => setViewMode("playmat")}>
                  Playmat
                </Button>
              </div>

              {viewMode === "compact" && (
                <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-3">
                  <span className="text-sm text-gray-500">Stack by:</span>
                  <ToggleGroup
                    type="single"
                    value={stackGrouping}
                    onValueChange={(value) => value && setStackGrouping(value as "by-name" | "by-printing")}
                  >
                    <ToggleGroupItem value="by-name" aria-label="Group by card name" size="sm">
                      Card Name
                    </ToggleGroupItem>
                    <ToggleGroupItem value="by-printing" aria-label="Group by printing" size="sm">
                      Printing
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              )}
            </div>

            <TabsContent value="builder" className="space-y-0">
              {viewMode === "catalog" ? (
                <DeckBuilderSplitView
                  deckId={deckId}
                  deck={displayDeck}
                  deckFormat={displayDeck.format}
                  onDeckUpdate={fetchDeck}
                  setDeck={(updater) => {
                    setDeck(updater);
                    setOptimisticDeck(updater);
                  }}
                />
              ) : viewMode === "playmat" ? (
                <PlaymatView
                  deck={displayDeck}
                  editable={!!canEdit}
                  ownershipRefreshKey={ownershipRefreshKey}
                  wantsMap={wantsMap}
                  deckCardCounts={deckCardCounts}
                  binderMap={binderMap}
                  onZoneClick={(zone) => {
                    const zoneMap: Record<string, typeof activeCategory> = {
                      hero: "hero",
                      equipment: "equipment",
                      maindeck: "maindeck",
                      inventory: "inventory",
                    };
                    if (zoneMap[zone]) {
                      setActiveCategory(zoneMap[zone]);
                      setViewMode("individual");
                    }
                  }}
                  onShuffle={() => {}}
                  onSwap={(card) => {
                    setSwappingPrinting(card);
                    setPrintingSwapOpen(true);
                  }}
                  onMove={handleMovePrinting}
                  onRemove={handleRemovePrinting}
                  onAddCard={(category) => {
                    const categoryMap: Record<string, typeof activeCategory> = {
                      hero: "hero",
                      equipment: "equipment",
                      maindeck: "maindeck",
                      inventory: "inventory",
                    };
                    if (categoryMap[category]) {
                      setActiveCategory(categoryMap[category]);
                      setIsCardSearchOpen(true);
                    }
                  }}
                  onAddToWants={handleAddToWants}
                  onAddToBinder={handleAddToBinder}
                  onRemoveFromBinder={handleRemoveFromBinder}
                  onRemoveFromWants={handleRemoveFromWants}
                  onToggleForTrade={handleToggleForTrade}
                  onUpdateTags={handleUpdateTags}
                />
              ) : viewMode === "list" ? (
                (["hero", "equipment", "maindeck", "inventory"] as const).map((category) => (
                  <DeckListView
                    key={category}
                    printings={filteredPrintings}
                    groupedCards={filteredGroupedCards}
                    category={category}
                    editable={!!canEdit}
                    ownershipStatus={ownershipStatus}
                    wantsMap={wantsMap}
                    binderMap={binderMap}
                    deckCardCounts={deckCardCounts}
                    onRemove={handleRemovePrinting}
                    onAddAnother={handleAddAnother}
                    onMove={handleMovePrinting}
                    onOpenPrintingSwap={handleOpenPrintingSwap}
                    onOpenOwnershipComparison={handleOpenOwnershipComparison}
                    onAddCard={() => {
                      setActiveCategory(category);
                      setIsCardSearchOpen(true);
                    }}
                    removingCards={removingCards}
                  />
                ))
              ) : (
                (["maindeck", "equipment", "inventory"] as const).map((category) => (
                  <DeckPrintingsGrid
                    key={category}
                    printings={filteredPrintings}
                    groupedCards={filteredGroupedCards}
                    category={category}
                    editable={!!canEdit}
                    viewMode={viewMode}
                    stackGrouping={stackGrouping}
                    ownershipStatus={ownershipStatus}
                    onRemove={handleRemovePrinting}
                    onAddAnother={handleAddAnother}
                    onMove={handleMovePrinting}
                    onOpenPrintingSwap={handleOpenPrintingSwap}
                    onAddCard={() => {
                      setActiveCategory(category);
                      setIsCardSearchOpen(true);
                    }}
                    SortablePrintingCard={SortablePrintingCard}
                    removingCards={removingCards}
                    movingCards={movingCards}
                    onAddToWants={handleAddToWants}
                    onAddToBinder={handleAddToBinder}
                    wantsMap={wantsMap}
                    binderMap={binderMap}
                    deckCardCounts={deckCardCounts}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="simulator">
              <DeckSimulator deck={displayDeck} />
            </TabsContent>

            <TabsContent value="matchups">
              {displayDeck && (
                <DeckMatchupsDialog
                  open={true}
                  onOpenChange={() => {}}
                  deckId={deckId}
                  deck={displayDeck}
                  inline={true}
                />
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <DeckFlow
                deckId={deckId}
                maindeck={(displayDeck.maindeck as any[]) ?? []}
                hero={(displayDeck.hero as any[]) ?? []}
              />
              <DeckAnalysis deck={deckForAnalysis} stats={deckStats} loading={loading} />
            </TabsContent>

            <TabsContent value="collection">
              <DeckBinderComparison deck={displayDeck} />
            </TabsContent>

            <TabsContent value="export">
              <DeckExport deck={displayDeck} onCopyList={() => {}} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DndContext>
  );
}
