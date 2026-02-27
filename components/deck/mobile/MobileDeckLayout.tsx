// components/deck/mobile/MobileDeckLayout.tsx
"use client";

import React, { useState } from "react";
import type { MobileDeckLayoutProps, DeckPrinting } from "./types";
import MobileDeckHeader from "./MobileDeckHeader";
import MobileCategoryTabs from "./MobileCategoryTabs";
import MobileDeckListView from "./MobileDeckListView";
import MobileDeckGridView from "./MobileDeckGridView";
import MobileDeckCardActionSheet from "./MobileDeckCardActionSheet";
import MobileFAB from "./MobileFAB";
import MobileDeckSearchOverlay from "./MobileDeckSearchOverlay";
import MobileDeckMenuSheet from "./MobileDeckMenuSheet";

export default function MobileDeckLayout(props: MobileDeckLayoutProps) {
  const {
    deck,
    printings,
    filteredPrintings,
    canEdit,
    activeCategory,
    setActiveCategory,
    ownershipStatus,
    wantsMap,
    binderMap,
    deckCardCounts,
    removingCards,
    movingCards,
    binders,
    selectedBinderId,
    setSelectedBinderId,
    onRemove,
    onAddAnother,
    onMove,
    onOpenPrintingSwap,
    onOpenOwnershipComparison,
    onAddCard,
    onAddToWants,
    onAddToBinder,
    onSelectCard,
    onOpenSearch,
    onOpenSettings,
    onOpenBulkImport,
  } = props;

  // Mobile-only local state
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedPrinting, setSelectedPrinting] = useState<
    (DeckPrinting & { category: string }) | null
  >(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const totalCards =
    (deck.hero?.length || 0) +
    (deck.equipment?.length || 0) +
    (deck.maindeck?.length || 0) +
    (deck.inventory?.length || 0);

  // Extract hero name for heroLegal search filter (same as DeckBuilderSplitView)
  const heroPrinting = deck.hero?.[0];
  const heroDetails = heroPrinting?.printingDetails;
  const heroName = heroDetails?.name || heroDetails?.display_name;

  const handleCardTap = (printing: DeckPrinting & { category: string }) => {
    setSelectedPrinting(printing);
    setIsActionSheetOpen(true);
  };

  const handleSearchAddCard = (card: any, printing: any, quantity: number) => {
    onSelectCard(card, printing, quantity);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileDeckHeader
        deck={deck}
        totalCards={totalCards}
        onMenuOpen={() => setIsMenuOpen(true)}
      />

      <MobileCategoryTabs
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        deck={deck}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Card list/grid */}
      {viewMode === "list" ? (
        <MobileDeckListView
          printings={filteredPrintings}
          category={activeCategory}
          ownershipStatus={ownershipStatus}
          wantsMap={wantsMap}
          onCardTap={handleCardTap}
          onAddCard={onAddAnother}
          onRemoveCard={onRemove}
        />
      ) : (
        <MobileDeckGridView
          printings={filteredPrintings}
          category={activeCategory}
          onCardTap={handleCardTap}
        />
      )}

      {/* FAB - only when user can edit */}
      {canEdit && <MobileFAB onClick={() => setIsSearchOpen(true)} />}

      {/* Card action sheet */}
      <MobileDeckCardActionSheet
        printing={selectedPrinting}
        isOpen={isActionSheetOpen}
        onOpenChange={setIsActionSheetOpen}
        canEdit={canEdit}
        ownershipStatus={ownershipStatus}
        wantsMap={wantsMap}
        binderMap={binderMap}
        allPrintings={printings}
        onMove={onMove}
        onMoveMultiple={props.onMoveMultiple}
        onAddAnother={onAddAnother}
        onOpenPrintingSwap={onOpenPrintingSwap}
        onRemove={onRemove}
        onAddToWants={onAddToWants}
        onAddToBinder={onAddToBinder}
        onOpenOwnershipComparison={onOpenOwnershipComparison}
      />

      {/* Search overlay */}
      <MobileDeckSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCard={handleSearchAddCard}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        deckFormat={deck.format}
        currentDeck={deck}
        heroName={heroName}
        onAddToWants={onAddToWants}
        onAddToBinder={onAddToBinder}
      />

      {/* Menu sheet */}
      <MobileDeckMenuSheet
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        canEdit={canEdit}
        binders={binders}
        selectedBinderId={selectedBinderId}
        onBinderChange={setSelectedBinderId}
        onOpenSettings={onOpenSettings}
        onOpenBulkImport={onOpenBulkImport}
        onNavigateAnalysis={() => {
          // These could scroll to sections or switch tabs in the future
          // For now the desktop tabs handle them
        }}
        onNavigateCollection={() => {}}
        onNavigateExport={() => {}}
      />
    </div>
  );
}
