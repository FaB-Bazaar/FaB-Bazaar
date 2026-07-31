// app/decks/[deckId]/analyze/page.tsx
"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { ArrowLeft, Settings, BarChart3, BookOpen, Upload, Pencil, Copy } from "lucide-react";

import DeckAnalysis from "@/components/deck/DeckAnalysis";
import DeckFlow from "@/components/deck/DeckFlow";
import DeckBinderComparison from "@/components/deck/DeckBinderComparison";
import PlaymatView from "@/components/deck/PlaymatView";
import DeckSimulator from "@/components/deck/DeckSimulator";
import MobileDeckLayout from "@/components/deck/mobile/MobileDeckLayout";
import DeckPageDialogs from "@/components/deck/DeckPageDialogs";

import { useDeckPage } from "@/hooks/deck/useDeckPage";
import { useAuth } from "@/contexts/AuthContext";
import { decksClient } from "@/lib/client";

const VALID_TABS = ["playmat", "analysis", "simulator", "collection"] as const;

export default function DeckViewPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId as string;
  const [copying, setCopying] = useState(false);

  const { user } = useAuth();
  const { authLoading, isMobile, state, handlers } = useDeckPage(deckId);

  const {
    loading,
    error,
    removingCards,
    movingCards,
    binders,
    selectedBinderId,
    ownershipStatus,
    wantsMap,
    binderMap,
    activeTab,
    activeCategory,
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
    setActiveCategory,
    setIsCardSearchOpen,
    setSettingsOpen,
    setBulkImportOpen,
    setSwappingPrinting,
    setPrintingSwapOpen,
    setSelectedBinderId,
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
  } = handlers;

  const handleCopyDeck = async () => {
    if (!displayDeck) return;
    setCopying(true);
    try {
      const data = await decksClient.createDeck({
        copyFromDeckId: displayDeck.publicId,
        name: `${displayDeck.name} (copy)`,
        format: displayDeck.format,
        heroName: displayDeck.heroName,
      } as any);
      if (data.success && data.data?.publicId) {
        router.push(`/decks/${data.data.publicId}/analyze`);
      }
    } catch {
      // silently fail
    } finally {
      setCopying(false);
    }
  };

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

  const currentTab = (VALID_TABS as readonly string[]).includes(activeTab) ? activeTab : "playmat";

  const dialogs = (
    <DeckPageDialogs
      deckId={deckId}
      displayDeck={displayDeck}
      state={state}
      handlers={handlers}
    />
  );

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

  return (
    <>
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

          <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center gap-3 mb-4">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="playmat">Playmat</TabsTrigger>
                <TabsTrigger value="analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />Analysis
                </TabsTrigger>
                <TabsTrigger value="simulator">Simulator</TabsTrigger>
                <TabsTrigger value="collection">
                  <BookOpen className="h-4 w-4 mr-2" />Collection
                </TabsTrigger>
              </TabsList>

              {canEdit && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/decks/${deckId}`}>
                    <Pencil className="h-4 w-4 mr-2" />Edit
                  </Link>
                </Button>
              )}
            </div>

            <TabsContent value="playmat">
              <PlaymatView
                deck={displayDeck}
                editable={!!canEdit}
                ownershipRefreshKey={ownershipRefreshKey}
                wantsMap={wantsMap}
                deckCardCounts={deckCardCounts}
                binderMap={binderMap}
                onZoneClick={() => {}}
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
              />
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <DeckFlow
                deckId={deckId}
                maindeck={(displayDeck.maindeck as any[]) ?? []}
                hero={(displayDeck.hero as any[]) ?? []}
              />
              <DeckAnalysis deck={deckForAnalysis} stats={deckStats} loading={loading} />
            </TabsContent>

            <TabsContent value="simulator">
              <DeckSimulator deck={displayDeck} />
            </TabsContent>

            <TabsContent value="collection">
              <DeckBinderComparison deck={displayDeck} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
