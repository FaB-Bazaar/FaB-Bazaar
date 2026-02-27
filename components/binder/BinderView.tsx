"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, BookOpen, BarChart3, Settings, AlertCircle, Plus } from "lucide-react"

// Refactored components
import BinderHeader from "./BinderHeader"
import BinderFilters from "./BinderFilters"
import BinderStats from "./BinderStats"
import BinderResultsBar from "./BinderResultsBar"
import BinderCardsGrid from "./BinderCardsGrid"
import SelectedCardsSidebar from "./SelectedCardsSidebar"
import BinderSettings from "@/components/binder/binder-settings"

// Hooks
import { useBinderState } from "@/hooks/useBinderState"
import { useBinderActions } from "@/hooks/useBinderActions"
import { useToast } from "@/hooks/use-toast"

// Dialogs
import CardSearchDialog from "@/components/dialogs/cards/card-search-dialog"
import EditCardDialog from "@/components/dialogs/cards/edit-card-dialog"
import TransferCardsDialog from "@/components/TransferCardsDialog"
import PrintingSwapDialog from '@/components/dialogs/cards/printing-swap-dialog'

// Client services
import { bindersClient } from '@/lib/client'

interface BinderViewProps {
  initialBinder: any;
  user: any;
  editable?: boolean;
  binderId?: string;
  cardMetadataMap?: Record<string, any>;
}

export default function BinderView({
  initialBinder,
  user,
  editable = false,
  binderId,
  cardMetadataMap = {},
}: BinderViewProps) {
  console.log('🔄 REFACTORED BinderView is rendering!', { binderId, editable })
  const { toast } = useToast()
  
  // Consolidated state management
  const {
    // Core state
    binder,
    setBinder,
    loading,
    setLoading,
    error,
    setError,
    metadata,
    ownerInfo,
    cardOrder,
    setCardOrder,
    stats,

    // UI state
    activeTab,
    setActiveTab,
    isCardSearchOpen,
    setIsCardSearchOpen,
    editingCard,
    setEditingCard,
    printingSwapCard,
    setPrintingSwapCard,
    transferDialogOpen,
    setTransferDialogOpen,

    // Filter state
    searchQuery,
    setSearchQuery,
    filterForTrade,
    setFilterForTrade,
    filterRarity,
    setFilterRarity,
    filterFoiling,
    setFilterFoiling,
    filterSet,
    setFilterSet,
    sortOption,
    setSortOption,

    // Selection state
    selectedCards,
    setSelectedCards,
    sidebarOpen,
    setSidebarOpen,
    copied,
    setCopied,

    // Computed values
    sortedCards,

    // Refresh state
    isRefreshing,
    lastRefreshTime,
  } = useBinderState(initialBinder)

  console.log('🔄 BinderView props:', { 
    initialBinderCards: initialBinder?.cards?.length,
    binderCards: binder?.cards?.length,
    binderId,
    editable 
  })

  // Consolidated action handlers  
  const {
    // Core actions
    handleManualRefresh,
    handleAddCard,
    handleRemoveCard,
    handleUpdateCard,
    handleUpdateCardQuantity,
    handleToggleForTrade,
    handleSetAllForTrade,
    handlePrintingSwap,
    handleSaveSettings,

    // Copy actions
    copyBinderToClipboard,
    copySelectedCardsToClipboard,

    // Selection actions
    handleCardSelect,
    handleQuantityChange,
    handleRemoveSelected,
    handleClearSelected,
  } = useBinderActions({
    binder,
    setBinder,
    setLoading,
    setError,
    selectedCards,
    setSelectedCards,
    setSidebarOpen,
    setCopied,
    setCardOrder,
    toast,
    editable,
    binderId
  })

  return (
    <div className="container mx-auto py-8 px-4 flex flex-row gap-8">
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        
        {/* Back Navigation */}
        <Link href="/" className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 w-auto mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        {/* Header Section */}
        <BinderHeader 
          binder={binder}
          user={user}
          editable={editable}
          loading={loading}
          isRefreshing={isRefreshing}
          lastRefreshTime={lastRefreshTime}
          stats={stats}
          ownerInfo={ownerInfo}
          onAddCard={() => setIsCardSearchOpen(true)}
          onRefresh={handleManualRefresh}
          onOpenSettings={() => setActiveTab("settings")}
        />

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Not For Trade Banner */}
        {binder?.cards?.length > 0 && binder.cards.every((card: any) => card.forTrade === false) && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-600 text-yellow-900 dark:text-yellow-100 text-center font-semibold text-lg shadow">
            <AlertCircle className="inline-block mr-2 align-text-bottom h-5 w-5" />
            All cards in this binder are currently marked as <span className="font-bold">Not For Trade</span>.
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="max-w-6xl mx-auto w-full">
          <Tabs defaultValue="cards" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="cards" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Stats
              </TabsTrigger>
              {editable && (
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>

            {/* Cards Tab */}
            <TabsContent value="cards">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-900 dark:text-gray-100">Loading binder...</p>
                </div>
              ) : binder?.cards.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">This binder is empty</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Add cards to this binder to get started</p>
                  {editable && (
                    <Button onClick={() => setIsCardSearchOpen(true)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Card
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <BinderFilters 
                    binder={binder}
                    metadata={metadata}
                    editable={editable}
                    loading={loading}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    filterForTrade={filterForTrade}
                    setFilterForTrade={setFilterForTrade}
                    filterRarity={filterRarity}
                    setFilterRarity={setFilterRarity}
                    filterFoiling={filterFoiling}
                    setFilterFoiling={setFilterFoiling}
                    filterSet={filterSet}
                    setFilterSet={setFilterSet}
                    sortOption={sortOption}
                    setSortOption={setSortOption}
                    stats={stats}
                    onSetAllForTrade={handleSetAllForTrade}
                  />
                  
                  <BinderResultsBar 
                    sortedCards={sortedCards}
                    binder={binder}
                    selectedCards={selectedCards}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    copied={copied}
                    editable={editable}
                    user={user}
                    onSelectForTrade={() => {
                      const forTradeCards = sortedCards.filter((card: any) => card.forTrade);
                      if (forTradeCards.length > 0) {
                        setSelectedCards(forTradeCards.map((card: any) => ({
                          ...card,
                          quantity: Math.min(card.quantity, 1),
                          maxQuantity: card.quantity
                        })));
                      }
                    }}
                    onSelectAll={() => {
                      setSelectedCards(sortedCards.map((card: any) => ({
                        ...card,
                        quantity: Math.min(card.quantity, 1),
                        maxQuantity: card.quantity
                      })));
                    }}
                    onCopyAll={copyBinderToClipboard}
                    onCopySelected={copySelectedCardsToClipboard}
                    onTransfer={() => setTransferDialogOpen(true)}
                  />

                  <BinderCardsGrid 
                    cards={sortedCards}
                    binder={binder}
                    editable={editable}
                    selectedCards={selectedCards}
                    transferDialogOpen={transferDialogOpen}
                    onCardSelect={handleCardSelect}
                    onEditCard={setEditingCard}
                    onRemoveCard={handleRemoveCard}
                    onToggleForTrade={handleToggleForTrade}
                    onUpdateCard={handleUpdateCard}
                    onUpdateCardQuantity={handleUpdateCardQuantity}
                    onOpenPrintingSwap={setPrintingSwapCard}
                    onAddCard={() => setIsCardSearchOpen(true)}
                    toast={toast}
                  />
                </>
              )}
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats">
              <BinderStats 
                binder={binder}
                stats={stats}
                loading={loading}
                editable={editable}
                onOpenSettings={() => setActiveTab("settings")}
              />
            </TabsContent>

            {/* Settings Tab */}
            {editable && (
              <TabsContent value="settings">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-900 dark:text-gray-100">Loading binder settings...</p>
                  </div>
                ) : (
                  <BinderSettings 
                    binder={{
                      id: binder?._id,
                      name: binder?.name || "Trade Binder",
                      description: binder?.description || "",
                      isPublic: binder?.isPublic !== undefined ? binder.isPublic : true,
                    }}
                    onSave={handleSaveSettings}
                  />
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Dialogs */}
        {editable && (
          <>
            <CardSearchDialog 
              open={isCardSearchOpen} 
              onOpenChange={setIsCardSearchOpen} 
              onSelectCard={handleAddCard} 
              destination="binder" 
            />
            
            {editingCard && (
              <EditCardDialog 
                card={editingCard} 
                open={!!editingCard} 
                onOpenChange={(open) => !open && setEditingCard(null)} 
                onSave={(updates) => handleUpdateCard(editingCard.id, updates)} 
              />
            )}
            
            <TransferCardsDialog
              open={transferDialogOpen}
              onOpenChange={setTransferDialogOpen}
              selectedCards={selectedCards}
              sourceSlug={binder.slug || binder.discordExternalId}
              onTransferComplete={() => window.location.reload()}
            />

            {printingSwapCard && (
              <PrintingSwapDialog
                open={!!printingSwapCard}
                onOpenChange={(open) => !open && setPrintingSwapCard(null)}
                currentPrinting={{
                  printingId: printingSwapCard.printingId || printingSwapCard.printingDetails?.printing_id,
                  cardUniqueId: printingSwapCard.card_unique_id || printingSwapCard.cardId || printingSwapCard.printingDetails?.card_unique_id,
                  cardName: printingSwapCard.display_name || printingSwapCard.name || 'Unknown Card'
                }}
                onSwap={async (newPrinting) => {
                  const result = await bindersClient.swapCardPrinting(
                    binder?._id,
                    printingSwapCard._id || printingSwapCard.id,
                    newPrinting.printing_id
                  );
                  return { success: result.success, error: result.error };
                }}
                onSwapComplete={handlePrintingSwap}
              />
            )}
          </>
        )}
      </div>

      {/* Selected Cards Sidebar */}
      <SelectedCardsSidebar 
        selectedCards={selectedCards}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onQuantityChange={handleQuantityChange}
        onRemoveSelected={handleRemoveSelected}
        onClearSelected={handleClearSelected}
        onTransfer={() => setTransferDialogOpen(true)}
        onCopySelected={copySelectedCardsToClipboard}
        copied={copied}
        editable={editable}
      />
    </div>
  );
}

